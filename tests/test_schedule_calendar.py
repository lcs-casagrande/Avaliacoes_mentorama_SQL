"""Calendário de consulta: UI real com fonte manual e exemplos sem persistência."""
import copy
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ScheduleCalendarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();demo.builder.build(cls.temp.name,calendar_preview=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.temp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
        cls.url='http://127.0.0.1:'+str(cls.http.server_port)+'/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.temp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url))
        self.page.goto(self.url);self.page.wait_for_selector('.scale-calendar')
        self.month('2026-10')
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests));self.context.close()
    def month(self,value):self.page.locator('#scale-month').fill(value);self.page.locator('#scale-month').dispatch_event('change')
    def only(self,department):
        if self.page.locator('[data-scale-action=all]').get_attribute('aria-pressed')!='true':self.page.locator('[data-scale-action=all]').click()
        for name in self.page.locator('[data-scale-action=department]').evaluate_all('(els)=>els.map(e=>e.dataset.department)'):
            if name!=department:self.page.get_by_role('button',name=name,exact=True).click()
    def test_source_fifteen_preserved_and_never_merged(self):
        rows=self.page.evaluate('IASDPIScheduleCalendar.legacy().filter(r=>r.department==="Sonoplastia")')
        self.assertEqual(len(rows),15);self.assertEqual(len({(r['date'],r['person']) for r in rows}),15)
        self.assertEqual([r['person'] for r in rows if r['date']=='2026-10-03'],['Mini Lucas'])
        self.assertEqual([r['date'] for r in rows if r['date'].startswith('2026-11')],['2026-11-01','2026-11-04'])
        self.assertIn('Rafa',{r['person'] for r in rows});self.assertIn('Raphael',{r['person'] for r in rows})
        self.only('Sonoplastia');self.assertEqual(self.page.locator('.scale-calendar .scale-tag').count(),13)
        self.month('2026-11');self.assertEqual(self.page.locator('.scale-calendar .scale-tag').count(),2)
        self.assertEqual(rows,self.page.evaluate('IASDPIScheduleCalendar.legacy().filter(r=>r.department==="Sonoplastia")'))
    def test_sunday_saturday_alignment_and_leap_year(self):
        self.assertEqual(self.page.locator('thead abbr').all_text_contents(),['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])
        # 01/10/2026 é quinta; quatro células anteriores vazias.
        self.assertEqual(self.page.locator('tbody .scale-days-row').first.locator('.scale-outside').count(),4)
        self.assertEqual(self.page.locator('[data-scale-action=day]').count(),31)
        self.month('2028-02');self.assertEqual(self.page.locator('[data-scale-action=day]').count(),29)
    def test_previous_next_and_today_sao_paulo(self):
        self.page.locator('[data-scale-action=next]').click();self.assertEqual(self.page.locator('#scale-month').input_value(),'2026-11')
        self.page.locator('[data-scale-action=previous]').click();self.assertEqual(self.page.locator('#scale-month').input_value(),'2026-10')
        self.page.clock.set_fixed_time('2026-11-01T01:00:00Z');self.page.locator('[data-scale-action=today]').click()
        self.assertEqual(self.page.locator('#scale-month').input_value(),'2026-10')
        self.assertEqual(self.page.locator('[aria-current=date]').get_attribute('data-date'),'2026-10-31')
    def test_date_click_all_four_entries_from_existing_sources(self):
        self.page.locator('[data-date="2026-10-10"]').click();text=self.page.locator('#scale-selected').inner_text()
        for value in ['Sonoplastia — Luan','Comunicação — Izabelle PI Souza','Ancionato — Adriano Borrego','Ancionato — Lucas Casagrande']:self.assertIn(value,text)
        self.assertEqual(self.page.locator('#scale-selected .scale-tag').count(),4)
        self.assertEqual(self.page.locator('#scale-selected .scale-tag small').count(),0)
        self.assertTrue(self.page.locator('#scale-selected').evaluate('(el)=>el===document.activeElement'))
    def test_filters_combined_restore_and_empty(self):
        self.only('Sonoplastia');self.page.locator('#scale-person').select_option('Rafa')
        self.assertEqual(self.page.locator('.scale-calendar .scale-tag').count(),2)
        self.only('Música');self.assertEqual(self.page.locator('.scale-calendar .scale-tag').count(),0)
        self.page.locator('#scale-person').select_option('all');self.page.locator('[data-scale-action=all]').click();self.assertEqual(self.page.locator('.scale-calendar .scale-chip').count(),18)
    def test_examples_removed_and_missing_context_preserved(self):
        before=self.page.evaluate('IASDPIScheduleCalendar.legacy()')
        self.assertEqual(self.page.locator('#scale-examples').count(),0);self.assertEqual(self.page.locator('.scale-calendar .scale-chip').count(),18)
        self.assertNotIn('Marciano',self.page.locator('.scale-calendar').inner_text());self.assertNotIn('Alexandre',self.page.locator('.scale-calendar').inner_text())
        self.assertEqual(self.page.locator('.scale-overview .scale-tag small').count(),0)
        self.assertIn('Funções ausentes da fonte não são inferidas',self.page.locator('.scale-overview').inner_text())
        self.assertEqual(before,self.page.evaluate('IASDPIScheduleCalendar.legacy()'))
        self.assertTrue(self.page.get_by_role('button',name='Criar escala',exact=True).is_disabled())
        self.assertEqual(self.page.evaluate('localStorage.length'),0)
    def test_access_to_existing_catalog_and_unsaved_guard(self):
        self.page.locator('[data-demo-view="schedule-setup"]').click();self.page.wait_for_selector('.schedule-list')
        self.page.locator('[data-schedule-action=create]').click();self.page.get_by_label('Nome completo',exact=True).fill('Ainda em edição')
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-demo-view="schedule-calendar"]').click()
        self.assertEqual(self.page.locator('[name=name]').input_value(),'Ainda em edição')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-demo-view="schedule-calendar"]').click();self.page.wait_for_selector('.scale-calendar')
    def test_primary_colors_distinct_accessible_contrast(self):
        values=self.page.locator('.scale-filter-bar .scale-filter').evaluate_all('(els)=>els.map(el=>({name:el.textContent,bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}))')
        self.assertEqual(len({v['bg'] for v in values}),5)
        def luminance(v):
            import re
            rgb=[int(x)/255 for x in re.findall(r'\d+',v)[:3]]
            linear=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb]
            return sum(x*w for x,w in zip(linear,[.2126,.7152,.0722]))
        for v in values:
            ratio=(luminance(v['bg'])+.05)/(luminance(v['fg'])+.05);self.assertGreaterEqual(ratio,4.5,v['name'])
    def test_unknown_department_color_escaping_and_missing_person(self):
        self.page.evaluate("window.IASDPICalendarSource=()=>[{id:'a',department:'Outro <teste>',person:'<script>alert(1)</script>',date:'2026-10-10',example:false},{id:'b',department:'Segundo outro',person:null,date:'2026-10-10',example:false}];render();IASDPIScheduleCalendar.mount();")
        self.assertEqual(self.page.locator('#app script').count(),0)
        self.assertIn('<script>alert(1)</script>',self.page.locator('#app').inner_text())
        backgrounds=self.page.locator('.scale-calendar [data-scale-color]').evaluate_all('(els)=>els.map(el=>getComputedStyle(el).backgroundColor)')
        self.assertGreaterEqual(len(set(backgrounds)),2)
    def test_responsiveness_long_names_five_widths(self):
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.evaluate("window.IASDPICalendarSource=()=>[{id:'long',date:'2026-10-10',person:'NomeSemEspaco'.repeat(20),department:'DepartamentoSemEspaco'.repeat(10),example:false}];render();")
        self.page.set_viewport_size({'width':360,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),360)
    def test_month_validation_and_no_external_requests(self):
        self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.monthDays("2026-02")'),28)
        with self.assertRaises(Exception):self.page.evaluate('IASDPIScheduleCalendar.monthDays("2026-99")')
        self.assertEqual(self.page.locator('input[type=time]').count(),0)
        self.assertTrue(self.page.evaluate("fetch('/forbidden').then(()=>false,()=>true)"))
    def test_standalone_html_with_csp_loads_calendar(self):
        # Criado em diretório próprio; não substitui os arquivos da demonstração.
        output=Path(self.temp.name)/'standalone.html'
        if not output.exists():demo.builder.standalone(self.temp.name,output)
        self.page.goto(self.url+'standalone.html');self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('script[src]').count(),0)
        self.assertIn('Sonoplastia',self.page.locator('.scale-filter-bar').inner_text())

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class PublicScheduleCalendarTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    setUp=base.FrontendAccessTests.setUp
    tearDown=base.FrontendAccessTests.tearDown
    supabase=base.FrontendAccessTests.supabase
    def test_public_calendar_route_default_no_examples_and_original_agenda(self):
        self.page.goto(self.base+'#schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('#scale-examples').count(),0)
        self.assertEqual(self.page.evaluate('ministrySchedules.Sonoplastia.length'),15)
        self.assertEqual(self.page.evaluate('ministrySchedules.Comunicação.length'),5)
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.page.locator('nav [data-page="agendas"]').click();self.page.wait_for_selector('#agenda-area')
        self.page.get_by_role('link',name='Calendário mensal de escalas',exact=True).click();self.page.wait_for_selector('.scale-calendar')
        self.page.go_back();self.page.wait_for_selector('#agenda-area')
