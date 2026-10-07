"""API local de programação e execução. Apenas biblioteca padrão do Python."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get('IASDPI_DB', str(ROOT / 'data' / 'iasdpi.sqlite3')))
TZ = ZoneInfo(os.environ.get('IASDPI_TIMEZONE', 'America/Sao_Paulo'))
HOST = os.environ.get('IASDPI_HOST', '127.0.0.1')
PORT = int(os.environ.get('IASDPI_PORT', '8000'))
TEAM = ('Ancião do mês', 'Recepção', 'Diácono', 'Diaconisa', 'Diretor de culto',
        'Sonoplastia', 'Equipe de louvor', 'Responsável pela programação')


class Problem(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


@contextmanager
def database():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    try:
        con.execute('BEGIN IMMEDIATE')
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS programs (
          id TEXT PRIMARY KEY, plan TEXT NOT NULL, status TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '', incident TEXT NOT NULL DEFAULT '',
          paused INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS executions (
          program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL, started TEXT NOT NULL, ended TEXT,
          PRIMARY KEY(program_id,item_id)
        );
        ''')
        columns = {row[1] for row in con.execute('PRAGMA table_info(programs)')}
        if 'execution_mode' not in columns:
            con.execute("ALTER TABLE programs ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'live'")

        if 'actual_details' not in columns:
            con.execute("ALTER TABLE programs ADD COLUMN actual_details TEXT NOT NULL DEFAULT '{}'")


def text(value, label, limit=200, required=False):
    if not isinstance(value, str) or len(value) > limit:
        raise Problem(f'{label}: texto inválido ou maior que {limit} caracteres.')
    value = value.strip()
    if required and not value:
        raise Problem(f'Informe {label.lower()}.')
    return value


def planned(date, clock, seconds=False):
    try:
        if not isinstance(clock, str) or len(clock) not in ((5, 8) if seconds else (5,)):
            raise ValueError()
        fmt = '%Y-%m-%d %H:%M:%S' if len(clock) == 8 else '%Y-%m-%d %H:%M'
        dt = datetime.strptime(f'{date} {clock}', fmt)
        if dt.strftime(fmt) != f'{date} {clock}':
            raise ValueError()
        return dt.replace(tzinfo=TZ).isoformat()
    except (ValueError, TypeError):
        raise Problem('Informe data e horários válidos.')


def validate_plan(body):
    if not isinstance(body, dict):
        raise Problem('Programação inválida.')
    date = text(body.get('date', ''), 'Data', 10, True)
    name = text(body.get('name', ''), 'Nome', required=True)
    start, end = body.get('start'), body.get('end')
    if planned(date, end) <= planned(date, start):
        raise Problem('O término deve ser posterior ao início, no mesmo dia.')
    items = body.get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise Problem('Cadastre entre 1 e 100 atividades.')
    result, ids, previous_end = [], set(), start
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise Problem('Atividade inválida.')
        identifier = item.get('id') or str(uuid.uuid4())
        if not isinstance(identifier, str) or len(identifier) > 64 or identifier in ids:
            raise Problem('Identificador de atividade inválido ou duplicado.')
        ids.add(identifier)
        a, b = item.get('start'), item.get('end')
        if planned(date, b) <= planned(date, a):
            raise Problem(f'Atividade {index + 1}: término deve ser depois do início.')
        parallel = (body.get('execution_mode') == 'manual' and item.get('parallel') is True and result
                    and result[-1].get('parallel') and a == result[-1]['start'] and b == result[-1]['end'])
        if (a < previous_end and not parallel) or a < start or b > end:
            raise Problem(f'Atividade {index + 1}: horários sobrepostos, fora de ordem ou fora da programação.')
        previous_end = b
        result.append(dict(id=identifier, block=text(item.get('block', ''), 'Bloco', required=True),
                           start=a, end=b, activity=text(item.get('activity', ''), 'Atividade', required=True),
                           responsible=text(item.get('responsible', ''), 'Responsável'),
                           note=text(item.get('note', ''), 'Observação da atividade', 2000), order=index + 1,
                           parallel=item.get('parallel') is True, end_inferred=item.get('end_inferred') is True))
    team = body.get('team', {})
    if not isinstance(team, dict):
        raise Problem('Equipe inválida.')
    return dict(date=date, name=name, start=start, end=end, items=result,
                team={role: text(team.get(role, ''), role) for role in TEAM})


def load(con, identifier):
    row = con.execute('SELECT id, plan, status, note, incident, paused, version, execution_mode, actual_details FROM programs WHERE id=?',
                      (identifier,)).fetchone()
    if row is None:
        raise Problem('Programação não encontrada.', 404)
    result = dict(row)
    result['plan'] = json.loads(result['plan'])
    result['actual_details'] = json.loads(result['actual_details'])
    result['paused'] = bool(result['paused'])
    result['executions'] = {r['item_id']: dict(r) for r in con.execute(
        'SELECT item_id, started, ended FROM executions WHERE program_id=?', (identifier,))}
    p = result['plan']
    if result['execution_mode'] == 'manual' and any(i['id'] == 'culto-03102026-1' for i in p['items']):
        removed = [i['id'] for i in p['items'] if i['id'] == 'culto-03102026-8' and i['activity'] == 'Tudo Vem de Ti']
        p['items'] = [i for i in p['items'] if i['id'] not in removed]
        for item_id in removed:
            result['executions'].pop(item_id, None)
        for index, item in enumerate(p['items']):
            item['order'] = index + 1
            if item['id'] == 'culto-03102026-6':
                item['end'], item['end_inferred'] = '10:05', False
            if item['id'] == 'culto-03102026-9':
                item['parallel'] = False
    result['planned_start'] = planned(p['date'], p['start'])
    result['planned_end'] = planned(p['date'], p['end'])
    for item in p['items']:
        item['planned_start'] = planned(p['date'], item['start'])
        item['planned_end'] = planned(p['date'], item['end'])
    return result


def revision(body, program):
    if body.get('version') != program['version']:
        raise Problem('Esta programação mudou em outra tela. Atualize antes de continuar.', 409)


def mutate(con, identifier, body):
    program = load(con, identifier)
    revision(body, program)
    if program['execution_mode'] == 'manual':
        raise Problem('Use o formulário de realizado para esta programação.', 409)
    action, status = body.get('action'), program['status']
    items, executions = program['plan']['items'], program['executions']
    active = next((e for e in executions.values() if e['ended'] is None), None)
    pending = next((i for i in items if i['id'] not in executions), None)
    stamp = now()  # Um único instante, gerado no servidor, para finalizar e avançar.
    if action == 'ready' and status == 'Planejamento':
        con.execute("UPDATE programs SET status='Pronta' WHERE id=?", (identifier,))
    elif action == 'start' and status == 'Pronta' and not executions:
        if program['plan']['date'] != datetime.now(TZ).date().isoformat():
            raise Problem('O acompanhamento só pode começar na data da programação. Duplique para hoje se quiser testar.')
        con.execute('INSERT INTO executions VALUES (?,?,?,NULL)', (identifier, items[0]['id'], stamp))
        con.execute("UPDATE programs SET status='Em andamento' WHERE id=?", (identifier,))
    elif action == 'next' and status == 'Em andamento' and active and not program['paused']:
        con.execute('UPDATE executions SET ended=? WHERE program_id=? AND item_id=?',
                    (stamp, identifier, active['item_id']))
        if pending:
            con.execute('INSERT INTO executions VALUES (?,?,?,NULL)', (identifier, pending['id'], stamp))
        else:
            con.execute("UPDATE programs SET status='Finalizada' WHERE id=?", (identifier,))
    elif action in ('pause', 'resume') and status == 'Em andamento':
        if program['paused'] == (action == 'pause'):
            raise Problem('Acompanhamento já está neste estado.', 409)
        con.execute('UPDATE programs SET paused=? WHERE id=?', (int(action == 'pause'), identifier))
    else:
        raise Problem('Ação indisponível para o estado atual.', 409)
    con.execute('UPDATE programs SET version=version+1 WHERE id=?', (identifier,))
    return load(con, identifier)


def save_actuals(con, program, body):
    revision(body, program)
    if program['execution_mode'] != 'manual':
        raise Problem('Este formulário é exclusivo das programações de registro manual.', 409)
    records = body.get('executions')
    if not isinstance(records, dict) or set(records) != {i['id'] for i in program['plan']['items']}:
        raise Problem('Envie os horários de todos os itens, deixando vazios os não preenchidos.')
    values, details = [], {}
    for item in program['plan']['items']:
        record = records[item['id']]
        if not isinstance(record, dict):
            raise Problem('Registro de horário inválido.')
        previous = program.get('actual_details', {}).get(item['id'], {})
        details[item['id']] = dict(note=text(record.get('note', previous.get('note', '')), 'Nota da atividade', 2000),
                                   responsible=text(record.get('responsible', previous.get('responsible', '')), 'Responsável', 200))
        start, end = record.get('start', ''), record.get('end', '')
        if not start and not end:
            continue
        if not start:
            raise Problem(f"{item['activity']}: informe o início real antes do término.")
        first = planned(program['plan']['date'], start, seconds=True)
        last = planned(program['plan']['date'], end, seconds=True) if end else None
        if last and last < first:
            raise Problem(f"{item['activity']}: término real não pode ser anterior ao início.")
        values.append((program['id'], item['id'], first, last))
    complete = len(values) == len(program['plan']['items']) and all(v[3] for v in values)
    if body.get('finalize') is True and not complete:
        raise Problem('Preencha início e término de todas as atividades para finalizar.')
    note = text(body.get('note', ''), 'Observações', 5000)
    incident = text(body.get('incident', ''), 'Ocorrência não prevista', 5000)
    # Validação completa antes de substituir registros; tudo na mesma transação.
    con.execute('DELETE FROM executions WHERE program_id=?', (program['id'],))
    con.executemany('INSERT INTO executions VALUES (?,?,?,?)', values)
    status = 'Finalizada' if body.get('finalize') is True else ('Em andamento' if values else 'Planejamento')
    con.execute('UPDATE programs SET status=?,note=?,incident=?,actual_details=?,paused=0,version=version+1 WHERE id=?',
                (status, note, incident, json.dumps(details, ensure_ascii=False), program['id']))
    return load(con, program['id'])


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'frontend'), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def json_response(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def body(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 250000:
                raise Problem('Corpo da requisição inválido ou muito grande.', 413)
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError()
            return body
        except (ValueError, UnicodeError):
            raise Problem('JSON inválido.')

    def route(self):
        path = urlsplit(self.path).path.strip('/').split('/')
        method = self.command
        if path == ['api', 'health'] and method == 'GET':
            return dict(status='ok', timezone=str(TZ), server_time=now())
        if len(path) < 2 or path[:2] != ['api', 'programs']:
            raise Problem('Rota não encontrada.', 404)
        body = {} if method == 'GET' else self.body()
        with database() as con:
            if len(path) == 2:
                if method == 'GET':
                    ids = con.execute('SELECT id FROM programs').fetchall()
                    return sorted((load(con, row['id']) for row in ids),
                                  key=lambda p: (p['plan']['date'], p['plan']['start']), reverse=True)
                if method == 'POST':
                    plan = validate_plan(body)
                    identifier = str(uuid.uuid4())
                    mode = 'manual' if body.get('execution_mode') == 'manual' else 'live'
                    con.execute('INSERT INTO programs(id,plan,status,execution_mode) VALUES (?,?,?,?)',
                                (identifier, json.dumps(plan), 'Planejamento', mode))
                    return load(con, identifier)
            if len(path) not in (3, 4):
                raise Problem('Rota não encontrada.', 404)
            identifier = path[2]
            program = load(con, identifier)
            if len(path) == 3:
                if method == 'GET':
                    return program
                if method == 'PUT':
                    revision(body, program)
                    if program['status'] not in ('Planejamento', 'Pronta'):
                        raise Problem('O plano fica protegido após o início. Duplique para preparar uma nova programação.', 409)
                    body['execution_mode'] = program['execution_mode']
                    plan = validate_plan(body)
                    con.execute("UPDATE programs SET plan=?,status='Planejamento',version=version+1 WHERE id=?",
                                (json.dumps(plan), identifier))
                    return load(con, identifier)
            if len(path) == 4:
                if path[3] == 'action' and method == 'POST':
                    return mutate(con, identifier, body)
                if path[3] == 'actuals' and method == 'PUT':
                    return save_actuals(con, program, body)
                if path[3] == 'notes' and method == 'PUT':
                    revision(body, program)
                    note = text(body.get('note', ''), 'Observações', 5000)
                    incident = text(body.get('incident', ''), 'Ocorrência não prevista', 5000)
                    con.execute('UPDATE programs SET note=?,incident=?,version=version+1 WHERE id=?',
                                (note, incident, identifier))
                    return load(con, identifier)
                if path[3] == 'duplicate' and method == 'POST':
                    plan = program['plan']
                    plan['date'] = body.get('date', '')
                    for item in plan['items']:
                        item['id'] = str(uuid.uuid4())
                    plan['execution_mode'] = program['execution_mode']
                    plan = validate_plan(plan)
                    new_id = str(uuid.uuid4())
                    con.execute('INSERT INTO programs(id,plan,status,execution_mode) VALUES (?,?,?,?)',
                                (new_id, json.dumps(plan), 'Planejamento', program['execution_mode']))
                    return load(con, new_id)
        raise Problem('Rota ou método indisponível.', 404)

    def dispatch(self):
        try:
            # Requisições de escrita são JSON e da mesma origem; não liberamos CORS.
            if self.command != 'GET':
                origin = self.headers.get('Origin')
                if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                    raise Problem('Origem não permitida.', 403)
                if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                    raise Problem('Use application/json.', 415)
            self.json_response(self.route())
        except Problem as exc:
            self.json_response(dict(error=str(exc)), exc.status)
        except sqlite3.Error:
            self.json_response(dict(error='Falha no banco. Consulte o terminal do servidor.'), 500)
            import traceback
            traceback.print_exc()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith('/api/'):
            self.dispatch()
        elif path in ('/', '/index.html', '/app.js', '/demo.js', '/actuals.js', '/styles.css'):
            super().do_GET()
        else:
            self.json_response(dict(error='Arquivo não encontrado.'), 404)

    def do_HEAD(self):
        if urlsplit(self.path).path in ('/', '/index.html', '/app.js', '/demo.js', '/actuals.js', '/styles.css'):
            super().do_HEAD()
        else:
            self.send_error(404)

    do_POST = dispatch
    do_PUT = dispatch


if __name__ == '__main__':
    initialize()
    print(f'IASDPI em http://{HOST}:{PORT} — fuso {TZ}', flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
