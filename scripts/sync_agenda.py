"""Importa calendários Google públicos sem alterar a fonte nem usar credenciais."""
import argparse
import base64
import hashlib
import json
import re
from datetime import date, datetime, time, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit, urljoin
from urllib.request import urlopen
from zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr

TZ = ZoneInfo('America/Sao_Paulo')
ROOT = Path(__file__).resolve().parents[1]


def public_get(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in {'iasd-paradainglesa.netlify.app', 'calendar.google.com'}:
        raise ValueError('Use o site oficial ou um calendário Google público em HTTPS.')
    with urlopen(url, timeout=30) as response:
        data = response.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise ValueError('O calendário ultrapassou o limite de leitura.')
    return data.decode('utf-8-sig')


class CalendarFrames(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type') == 'module' and dict(attrs).get('src'):
            self.scripts.append(dict(attrs)['src'])
        if tag != 'iframe':
            return
        source = dict(attrs).get('src', '')
        if urlsplit(source).hostname == 'calendar.google.com':
            self.ids.extend(parse_qs(urlsplit(source).query).get('src', []))


def text(value):
    return re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value).strip()


def parse_ics(data):
    if 'BEGIN:VCALENDAR' not in data:
        raise ValueError('A fonte não retornou um calendário iCalendar válido.')
    lines = re.sub(r'\r?\n[ \t]', '', data).splitlines()
    events, current, depth = [], None, 0
    for line in lines:
        if line == 'BEGIN:VEVENT':
            current, depth = {}, 0
        elif line == 'END:VEVENT':
            if current is not None:
                events.append(current)
            current = None
        elif current is not None:
            if line.startswith('BEGIN:'):
                depth += 1
            elif line.startswith('END:'):
                depth -= 1
            elif depth == 0:
                match = re.match(r'^((?:[^":]|"[^"]*")+):(.*)$', line)
                if match:
                    key, value = match.groups()
                    name, *params = key.split(';')
                    current.setdefault(name.upper(), []).append((dict(p.split('=', 1) for p in params if '=' in p), value))
    return events


def prop(event, name, default=''):
    return event.get(name, [({}, default)])[0][1]


def instant(entry):
    params, value = entry
    if params.get('VALUE') == 'DATE' or len(value) == 8:
        return datetime.combine(datetime.strptime(value, '%Y%m%d').date(), time(), TZ), True
    zone = ZoneInfo(params.get('TZID', 'America/Sao_Paulo').strip('"'))
    if value.endswith('Z'):
        zone, value = ZoneInfo('UTC'), value[:-1]
    return datetime.strptime(value, '%Y%m%dT%H%M%S').replace(tzinfo=zone), False


def classify(title):
    for prefix, kind in [('Ancião do Mês:', 'monthly'), ('Ancião da Semana:', 'weekly')]:
        if title.casefold().startswith(prefix.casefold()):
            return kind, title[len(prefix):].strip()
    return 'event', ''


def expand_calendar(data, calendar_id, start, end):
    raw = parse_ics(data)
    masters, overrides = {}, {}
    for event in raw:
        if not prop(event, 'UID') or 'DTSTART' not in event:
            continue
        uid = prop(event, 'UID')
        key = instant(event['RECURRENCE-ID'][0])[0].isoformat() if 'RECURRENCE-ID' in event else None
        target = overrides if key else masters
        identity = (uid, key) if key else uid
        previous = target.get(identity)
        if previous is None or (int(prop(event, 'SEQUENCE', '0')), prop(event, 'LAST-MODIFIED')) >= (int(prop(previous, 'SEQUENCE', '0')), prop(previous, 'LAST-MODIFIED')):
            target[identity] = event
    result = []

    def append(event, occurrence, recurrence_key):
        if prop(event, 'STATUS').upper() == 'CANCELLED':
            return
        first, all_day = instant(event['DTSTART'][0])
        if 'DTEND' in event:
            last = instant(event['DTEND'][0])[0]
        elif 'DURATION' in event:
            duration = re.fullmatch(r'P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?', prop(event, 'DURATION'))
            if not duration:
                raise ValueError('Duração de evento não suportada.')
            weeks, days, hours, minutes, seconds = (int(v or 0) for v in duration.groups())
            last = first + timedelta(weeks=weeks, days=days, hours=hours, minutes=minutes, seconds=seconds)
        else:
            last = first + (timedelta(days=1) if all_day else timedelta())
        actual_end = occurrence + (last - first)
        if actual_end < start or occurrence >= end or (actual_end == start and actual_end > occurrence):
            return
        source_title = text(prop(event, 'SUMMARY')) or 'Evento sem título'
        title, separator, title_department = source_title.partition('|')
        title = title.strip()
        title_department = title_department.strip()
        description = text(prop(event, 'DESCRIPTION'))
        department = re.search(r'(?:^|\n)(?:Departamento|Ministério)\s*:\s*([^\n]+)', description, re.I)
        kind, person = classify(title)
        begin = occurrence.astimezone(TZ)
        finish = actual_end.astimezone(TZ)
        identity = calendar_id + '\0' + prop(event, 'UID') + '\0' + recurrence_key
        result.append(dict(id=hashlib.sha256(identity.encode()).hexdigest()[:32], title=title, kind=kind, person=person,
                           start=begin.date().isoformat() if all_day else begin.isoformat(),
                           end=finish.date().isoformat() if all_day else finish.isoformat(), allDay=all_day,
                           startDate=begin.date().isoformat(), endDate=(finish.date() - timedelta(days=1) if all_day else (finish-timedelta(microseconds=1)).date() if finish>begin and finish.time()==time() else finish.date()).isoformat(),
                           department=title_department if separator and title_department else department[1].strip() if department else 'Não informado',
                           wholeDay=(not all_day and begin.date()==finish.date() and begin.time()==time() and finish.time()==time(23,59)), location=text(prop(event, 'LOCATION'))))

    for uid, event in masters.items():
        if prop(event, 'STATUS').upper() == 'CANCELLED':
            continue
        first, all_day = instant(event['DTSTART'][0])
        last = instant(event['DTEND'][0])[0] if 'DTEND' in event else first + timedelta(days=1)
        occurrences = {first}
        if 'RRULE' in event:
            occurrences = set(rrulestr(prop(event, 'RRULE'), dtstart=first).between(start - max(last - first, timedelta(days=1)), end, inc=True))
        for params, values in event.get('RDATE', []):
            occurrences.update(instant((params, value))[0] for value in values.split(','))
        excluded = {instant((params, value))[0] for params, values in event.get('EXDATE', []) for value in values.split(',')}
        for occurrence in sorted(occurrences - excluded):
            key = occurrence.isoformat()
            if (uid, key) not in overrides:
                append(event, occurrence, key)
    for (uid, key), event in overrides.items():
        append(event, instant(event['DTSTART'][0])[0], key)
    return result


def sync(site, calendar_ids, first_month, last_month):
    if not calendar_ids:
        parser = CalendarFrames()
        parser.feed(public_get(site))
        calendar_ids = parser.ids
        if not calendar_ids:
            for asset in parser.scripts[:5]:
                for embedded in re.findall(r'https://calendar\.google\.com/calendar/embed\?[^\"\s<>]+', public_get(urljoin(site, asset))):
                    calendar_ids.extend(parse_qs(urlsplit(embedded).query).get('src', []))
        calendar_ids = list(dict.fromkeys(calendar_ids))
    calendar_ids = [base64.urlsafe_b64decode(value + '=' * (-len(value) % 4)).decode() if '@' not in value else value for value in calendar_ids]
    if not calendar_ids:
        raise ValueError('Nenhum iframe público do Google Calendar foi encontrado no site. Informe --calendar-id.')
    start = datetime.fromisoformat(first_month + '-01').replace(tzinfo=TZ)
    last = date.fromisoformat(last_month + '-01')
    end = datetime.combine((last.replace(day=28) + timedelta(days=4)).replace(day=1), time(), TZ)
    if end <= start:
        raise ValueError('Período de sincronização inválido.')
    records = []
    for identifier in calendar_ids:
        url = 'https://calendar.google.com/calendar/ical/' + quote(identifier, safe='') + '/public/basic.ics'
        records.extend(expand_calendar(public_get(url), identifier, start, end))
    unique, identities = {}, set()
    for event in sorted(records, key=lambda e: (e['start'], e['title'])):
        identity = (event['title'], event['start'], event['end'], event['department'], event['location'], event['kind'])
        if event['id'] in unique or identity in identities:
            continue
        unique[event['id']] = event
        identities.add(identity)
    return dict(status='synced', source=site, syncedAt=datetime.now(TZ).isoformat(), fromMonth=first_month,
                toMonth=last_month, calendars=calendar_ids, duplicateCount=len(records) - len(unique), events=list(unique.values()))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', default='https://iasd-paradainglesa.netlify.app/')
    parser.add_argument('--calendar-id', action='append', default=[])
    parser.add_argument('--from-month', default='2026-02')
    parser.add_argument('--to-month', default=f'{datetime.now(TZ).year + 3}-12')
    parser.add_argument('--output', type=Path, default=ROOT / 'frontend' / 'agenda-data.js')
    args = parser.parse_args()
    # A fonte inteira precisa ser validada antes de substituir a última sincronização.
    try:
        payload = sync(args.site, args.calendar_id, args.from_month, args.to_month)
        content = 'window.IASDPIAgendaData = ' + json.dumps(payload, ensure_ascii=False).replace('<', '\\u003c') + ';\n'
        temporary = args.output.with_suffix('.tmp')
        temporary.write_text(content, encoding='utf-8')
        temporary.replace(args.output)
        print(f"Sincronizados {len(payload['events'])} registros; {payload['duplicateCount']} duplicações idênticas removidas.")
    except Exception as error:
        parser.exit(1, f'Não foi possível sincronizar: {error}. A última agenda foi preservada.\n')
