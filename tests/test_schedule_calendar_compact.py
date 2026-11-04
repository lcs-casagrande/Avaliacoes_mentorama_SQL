"""Filtros múltiplos, ícones e períodos oficiais sem atribuições inventadas."""
from datetime import date,timedelta
import json
from pathlib import Path
import unittest
import test_schedule_calendar as calendar
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and __import__('shutil').which('chromium'),'Requer Chromium')
class CompactCalendarTests(unittest.TestCase):
    setUpClass=classmethod(calendar.ScheduleCalendarTests.setUpClass.__func__)
    tearDownClass=classmethod(calendar.ScheduleCalendarTests.tearDownClass.__func__)
    setUp=calendar.ScheduleCalendarTests.setUp
    tearDown=calendar.ScheduleCalendarTests.tearDown
    month=calendar.ScheduleCalendarTests.month
    only=calendar.ScheduleCalendarTests.only
    def test_people_above_departments_and_no_clear_button(self):
        self.assertEqual(self.page.get_by_role('button',name='Limpar filtros',exact=True).count(),0)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            person=self.page.locator('#scale-person').bounding_box();departments=self.page.locator('.scale-filter-bar').bounding_box()
            self.assertLessEqual(person['y']+person['height'],departments['y'])
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
    def test_all_toggle_none_all_and_partial_with_person_and_month_preserved(self):
        self.page.locator('#scale-person').select_option('Rafa')
        button=self.page.get_by_role('button',name='Todos',exact=True)
        self.assertEqual(button.get_attribute('aria-pressed'),'true');button.click()
        self.assertEqual(button.get_attribute('aria-pressed'),'false')
        self.assertEqual(self.page.locator('.scale-filter[aria-pressed=true]').count(),0)
        self.assertEqual(self.page.locator('.scale-chip').count(),0)
        self.month('2026-11');self.assertEqual(self.page.locator('.scale-filter[aria-pressed=true]').count(),0)
        button.focus();self.page.keyboard.press('Enter')
        self.assertEqual(self.page.locator('#scale-person').input_value(),'Rafa')
        self.assertEqual(self.page.locator('.scale-filter[aria-pressed=false]').count(),0)
        self.assertEqual(self.page.locator('.scale-chip').count(),0)
        self.month('2026-10');self.assertEqual(self.page.locator('.scale-chip').count(),2)
        self.page.get_by_role('button',name='Música',exact=True).click();button.click()
        self.assertEqual(self.page.locator('.scale-filter[aria-pressed=false]').count(),0)
    def test_help_tooltip_hover_keyboard_escape_and_click(self):
        button=self.page.get_by_role('button',name='Ajuda sobre os filtros',exact=True);tip=self.page.locator('#scale-help-tip')
        self.assertFalse(tip.is_visible());button.hover();self.assertTrue(tip.is_visible())
        self.assertIn('Toque nos departamentos',tip.inner_text())
        self.page.mouse.move(0,0);self.assertFalse(tip.is_visible())
        self.page.keyboard.press('Tab');button.focus();self.assertTrue(tip.is_visible())
        self.assertEqual(button.get_attribute('aria-expanded'),'true')
        self.page.keyboard.press('Escape');self.assertFalse(tip.is_visible())
        self.page.keyboard.press('Enter');self.assertTrue(tip.is_visible())
        self.page.keyboard.press('Enter');self.assertFalse(tip.is_visible())
        self.page.locator('#scale-person').focus();button.click();self.assertTrue(tip.is_visible())
        self.page.locator('#scale-person').click();self.assertFalse(tip.is_visible())
        self.page.set_viewport_size({'width':360,'height':1000});button.hover()
        box=tip.bounding_box();self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],360)
    def test_all_manual_entries_exact_source_no_writes(self):
        rows=self.page.evaluate('IASDPIScheduleCalendar.legacy()')
        self.assertEqual(len(rows),20);self.assertEqual(len({r['id'] for r in rows}),20)
        text=(base.ROOT/'frontend/agenda.js').read_text()
        expected=[('2026-10-03','Henrique'),('2026-10-10','Izabelle PI Souza'),('2026-10-17','Simone/Profªde Pilates 🧘'),('2026-10-24','macedo Logos'),('2026-10-31','Letícia PI')]
        self.assertEqual([(r['date'],r['person']) for r in rows if r['department']=='Comunicação'],expected)
        before=self.page.evaluate('JSON.stringify(IASDPIScheduleCalendar.data())');self.only('Comunicação');self.month('2026-11');self.month('2026-10')
        self.assertEqual(self.page.locator('.scale-chip').count(),5)
        self.assertEqual(self.page.evaluate('JSON.stringify(IASDPIScheduleCalendar.data())'),before)
        self.assertEqual(self.page.evaluate('localStorage.length'),0)
    def test_chips_names_without_department_repetition_and_full_accessible_day(self):
        self.only('Sonoplastia');chip=self.page.locator('[data-date="2026-10-04"] .scale-chip')
        self.assertEqual(chip.locator('.scale-person-name').inner_text(),'Rafa')
        self.assertEqual(chip.locator('svg[aria-hidden=true]').count(),1)
        self.assertEqual(chip.get_attribute('title'),'Sonoplastia — Rafa · Função não informada')
        self.assertIn('Sonoplastia — Rafa',self.page.locator('[data-date="2026-10-04"]').get_attribute('aria-label'))
        self.page.locator('[data-date="2026-10-04"]').focus();self.page.keyboard.press('Enter')
        self.assertIn('Sonoplastia — Rafa',self.page.locator('#scale-selected').inner_text())
        self.assertIn('Função não informada',self.page.locator('#scale-selected').inner_text())
    def test_multi_filters_preserved_and_all_restores(self):
        self.page.get_by_role('button',name='Comunicação',exact=True).click();self.page.get_by_role('button',name='Ancionato',exact=True).click()
        self.assertEqual(self.page.get_by_role('button',name='Comunicação',exact=True).get_attribute('aria-pressed'),'false')
        self.assertEqual(self.page.locator('.scale-chip').count(),13);self.assertEqual(self.page.locator('.scale-band').count(),0)
        self.month('2026-11');self.assertEqual(self.page.locator('.scale-chip').count(),2)
        self.assertEqual(self.page.get_by_role('button',name='Ancionato',exact=True).get_attribute('aria-pressed'),'false')
        self.page.get_by_role('button',name='Todos',exact=True).click();self.assertGreater(self.page.locator('.scale-band').count(),0)
    def test_keyboard_toggle_and_empty_selection(self):
        for button in self.page.locator('[data-scale-action=department]').all():
            button.focus();self.page.keyboard.press('Space')
        self.assertEqual(self.page.locator('.scale-chip').count(),0);self.assertEqual(self.page.locator('.scale-band').count(),0)
        self.assertIn('0 escalas pontuais',self.page.locator('.scale-result').inner_text())
        self.assertEqual(self.page.get_by_role('button',name='Todos',exact=True).get_attribute('aria-pressed'),'false')
        self.page.get_by_role('button',name='Música',exact=True).focus();self.page.keyboard.press('Enter')
        self.month('2026-11');self.assertEqual(self.page.get_by_role('button',name='Música',exact=True).get_attribute('aria-pressed'),'true')
        self.assertEqual(self.page.locator('.scale-chip').count(),0)
    def test_month_and_week_bands_exact_inclusive_october_periods(self):
        self.only('Ancionato')
        monthly=self.page.locator('.scale-monthly').evaluate_all('(els)=>els.map(e=>({id:e.dataset.scaleId,from:e.dataset.from,to:e.dataset.to}))')
        self.assertEqual(len(monthly),1)
        self.assertEqual(monthly[0]['from'],'2026-10-01')
        self.assertEqual(monthly[-1]['to'],'2026-10-31')
        days=[]
        for part in monthly:
            start,end=date.fromisoformat(part['from']),date.fromisoformat(part['to']);days.extend((start+timedelta(days=i)).isoformat() for i in range((end-start).days+1))
        self.assertEqual(len(days),31);self.assertEqual(len(set(days)),31)
        weekly=self.page.locator('.scale-weekly');self.assertEqual(weekly.count(),5)
        self.assertEqual(weekly.first.get_attribute('data-from'),'2026-10-01');self.assertIn('27/09/2026 a 03/10/2026',weekly.first.get_attribute('aria-label'))
        self.assertIn('Elmo Carneiro',weekly.first.inner_text())
    def test_monthly_responsible_only_above_weekday_header_and_thinner(self):
        self.assertEqual(self.page.locator('.scale-calendar .scale-monthly').count(),0)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            bar=self.page.locator('.scale-month-responsibles .scale-monthly')
            self.assertEqual(bar.count(),1)
            self.assertIn('Ancião do Mês: Adriano Borrego',' '.join(bar.inner_text().split()))
            self.assertLessEqual(bar.bounding_box()['height'],30)
            self.assertLessEqual(bar.bounding_box()['y']+bar.bounding_box()['height'],self.page.locator('.scale-calendar thead').bounding_box()['y'])
        self.page.get_by_role('button',name='Ancionato',exact=True).click()
        self.assertEqual(self.page.locator('.scale-month-responsibles').count(),0)
        self.page.get_by_role('button',name='Ancionato',exact=True).click()
        self.month('2026-11')
        self.assertIn('Elmo Carneiro',self.page.locator('.scale-monthly').inner_text())
    def test_week_crossing_november_december_split_without_duplicate_sources(self):
        self.only('Ancionato');self.month('2026-11');last=self.page.locator('.scale-weekly').last
        identifier=last.get_attribute('data-scale-id');self.assertEqual(last.get_attribute('data-from'),'2026-11-29');self.assertEqual(last.get_attribute('data-to'),'2026-11-30')
        self.month('2026-12');first=self.page.locator('.scale-weekly').first
        self.assertEqual(first.get_attribute('data-scale-id'),identifier);self.assertEqual(first.get_attribute('data-from'),'2026-12-01');self.assertEqual(first.get_attribute('data-to'),'2026-12-05')
    def test_band_keyboard_details_full_role_person_and_period(self):
        self.only('Ancionato');bar=self.page.locator('.scale-monthly').first;bar.focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#scale-selected').evaluate('(e)=>e===document.activeElement'))
        text=self.page.locator('#scale-selected').inner_text();self.assertIn('Adriano Borrego',text);self.assertIn('Ancião do Mês',text);self.assertIn('01/10/2026 a 31/10/2026',text)
        self.page.locator('.scale-weekly').first.focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#scale-selected').evaluate('(e)=>e===document.activeElement'))
        self.assertIn('Ancião da Semana',self.page.locator('#scale-selected').inner_text())
        self.assertIn('Elmo Carneiro',self.page.locator('#scale-selected').inner_text())
    def test_source_snapshot_matches_official_and_no_invented_assignments(self):
        raw=(base.ROOT/'frontend/agenda-data.js').read_text();official=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
        expected={e['id']:(e['kind'],e['person'],e['startDate'],e['endDate']) for e in official['events'] if e['kind'] in ['monthly','weekly']}
        actual=self.page.evaluate('IASDPIScheduleCalendar.periods()')
        self.assertEqual(len(actual),len(expected))
        for r in actual:self.assertEqual((r['kind'],r['person'],r['startDate'],r['endDate']),expected[r['id'].removeprefix('official:')])
        self.assertFalse(any(r['department'] in ['Música','Diaconato'] for r in self.page.evaluate('IASDPIScheduleCalendar.data()')))
        self.assertNotIn('A definir',self.page.locator('.scale-calendar').inner_text())
        self.assertEqual(self.page.locator('#scale-examples').count(),0)
    def test_missing_real_role_only_and_no_periods_without_source(self):
        self.page.evaluate("window.IASDPICalendarOfficialSource=()=>({events:[]});window.IASDPICalendarSource=()=>[];render();")
        self.assertEqual(self.page.locator('.scale-band').count(),0);self.assertNotIn('A definir',self.page.locator('.scale-overview').inner_text())
        self.page.evaluate("window.IASDPICalendarOfficialSource=()=>({events:[{id:'empty-real-role',kind:'weekly',startDate:'2026-10-04',endDate:'2026-10-10',person:null}]});render();")
        self.assertIn('A definir',self.page.locator('.scale-weekly').inner_text());self.assertIn('Ancião da Semana',self.page.locator('.scale-overview').inner_text())
    def test_overlapping_roles_do_not_hide_any_period(self):
        self.page.evaluate("window.IASDPICalendarOfficialSource=()=>({events:[{id:'one',kind:'weekly',startDate:'2026-10-04',endDate:'2026-10-10',person:'Pessoa A de teste'},{id:'two',kind:'weekly',startDate:'2026-10-04',endDate:'2026-10-07',person:'Pessoa B de teste'}]});render();")
        self.assertEqual(self.page.locator('.scale-weekly').count(),2)
        self.assertEqual(self.page.locator('.scale-band-row[data-band-kind=weekly]').count(),2)
    def test_bands_align_with_days_and_text_never_breaks_midword(self):
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.assertLessEqual(abs(self.page.locator('.scale-weekly').first.bounding_box()['height']-self.page.locator('.scale-chip').first.bounding_box()['height']),1)
            align=self.page.evaluate('''()=>[...document.querySelectorAll('.scale-band')].map(bar=>{const week=bar.closest('.scale-week-group'),dates=week.querySelector('.scale-days-row'),numbers=week.querySelector('.scale-number-row');const from=dates.querySelector('[data-scale-day="'+bar.dataset.from+'"]'),to=dates.querySelector('[data-scale-day="'+bar.dataset.to+'"]');return {left:Math.abs(bar.getBoundingClientRect().left-from.getBoundingClientRect().left),right:Math.abs(bar.getBoundingClientRect().right-to.getBoundingClientRect().right),aboveDays:bar.getBoundingClientRect().bottom<=dates.getBoundingClientRect().top,belowNumbers:numbers.getBoundingClientRect().bottom<=bar.getBoundingClientRect().top}})''')
            for result in align:self.assertLessEqual(result['left'],2);self.assertLessEqual(result['right'],2);self.assertTrue(result['aboveDays']);self.assertTrue(result['belowNumbers'])
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.assertEqual(self.page.locator('.scale-chip .scale-person-name').first.evaluate('(e)=>getComputedStyle(e).whiteSpace'),'nowrap')
