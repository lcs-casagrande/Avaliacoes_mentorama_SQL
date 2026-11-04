"""Pacote /b1/ isolado, preservação da raiz e fluxos demonstrativos no Chromium."""
from functools import partial
from http.server import ThreadingHTTPServer
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as old
sys.path.insert(0,str(base.ROOT/'scripts'))
import prepare_b1_demo as package

def identifier(n):return f'00000000-0000-4000-8000-{n:012}'

class B1DemoPackageTests(unittest.TestCase):
    def test_ten_static_files_root_unchanged_and_no_credentials(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);history=root/'history';old.builder.build(history,calendar_preview=True)
            result=package.prepare(root/'site',history)
            self.assertEqual(len(result['files']),10);self.assertTrue(result['historical_root_unchanged'])
            for name in package.FILES:self.assertEqual((root/'site'/name).read_bytes(),(history/name).read_bytes())
            text=''.join(p.read_text() for p in (root/'site/b1').iterdir())
            for value in ['Henrique','Adriano Borrego','Mini Lucas','Luan','sb_publishable_','sb_secret_','https://','createClient']:
                self.assertNotIn(value,text)
            self.assertIn("connect-src 'none'",text);self.assertIn('DEMONSTRAÇÃO — DADOS FICTÍCIOS',text)
            html=(root/'site/b1/index.html').read_text();self.assertIn('href="../" target="_blank" rel="noopener"',html)
    def test_tampered_or_incomplete_history_and_existing_destination_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);history=root/'history';old.builder.build(history,calendar_preview=True)
            package.prepare(root/'site',history)
            with self.assertRaises(ValueError):package.prepare(root/'site',history)
            (history/'demo.js').write_text('adulterado')
            with self.assertRaisesRegex(ValueError,'Integridade'):package.prepare(root/'bad',history)
            self.assertFalse((root/'bad').exists())
            (history/'demo.js').unlink()
            with self.assertRaisesRegex(ValueError,'obrigatório ausente'):package.prepare(root/'incomplete',history)
            self.assertFalse((root/'incomplete').exists())

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class B1HomologationDemoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();root=Path(cls.tmp.name);history=root/'history';old.builder.build(history,calendar_preview=True)
        cls.site=root/'site';package.prepare(cls.site,history)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=str(cls.site)));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url))
        self.page.goto(self.url+'b1/');self.page.wait_for_selector('#b1-scope');self.scope(1)
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.assertTrue(all(url.startswith(self.url) for url in self.requests));self.context.close()
    def scope(self,department):
        self.page.locator('#b1-scope [name=department]').select_option(identifier(department));self.page.locator('#b1-scope [name=month]').fill('2026-10');self.page.locator('#b1-scope button').click();self.page.wait_for_selector('#b1-recurring')
    def generate(self):
        form=self.page.locator('#b1-recurring');form.locator('[name=title]').fill('Culto fictício de sábado');form.locator('[name=start]').fill('09:30');form.locator('[name=end]').fill('11:30')
        form.locator('[value="3"]').uncheck();form.locator('[value="0"]').uncheck();form.locator('button').click();self.page.wait_for_function('IASDPIB1Preview.events.length===5')
    def assign(self,person=20):
        self.page.locator('.b1-event-list input').first.check();self.page.locator('#b1-add button').click();self.page.locator('.b1-requirement select').first.select_option(identifier(person))
    def publish(self):
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click()
    def test_four_departments_have_eligible_fictional_people_no_auto_assignments(self):
        catalog=self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_catalog')")
        self.assertEqual(len(catalog['people']),4);self.assertEqual(len(catalog['departments']),4)
        for department in catalog['departments']:
            self.assertTrue(any(q['department_id']==department['id'] for q in catalog['qualifications']))
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),0)
        self.assertEqual(self.page.evaluate('IASDPICalendarSource()'),[])
    def test_cross_department_conflict_can_be_reproduced_and_resolved_without_console(self):
        self.generate();self.assign(20);self.page.locator('[data-b1-action=save]').click()
        self.scope(3);self.assign(20);self.page.locator('[data-b1-action=save]').click()
        self.assertIn('Conflito de horários',self.page.locator('.b1-status [role=alert]').inner_text())
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),1)
        self.assertEqual(self.page.locator('.b1-requirement select').input_value(),identifier(20))
        self.page.locator('.b1-requirement select').select_option(identifier(22));self.page.locator('[data-b1-action=save]').click();self.publish()
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),2)
        self.page.locator('[data-demo-view=schedule-calendar]').click();self.page.wait_for_selector('.scale-calendar')
        self.page.locator('#scale-month').fill('2026-10');self.page.locator('#scale-month').dispatch_event('change')
        self.assertEqual(self.page.locator('.scale-chip').count(),1);self.assertIn('Gama',self.page.locator('.scale-chip').inner_text())
        self.assertIn('DEMONSTRAÇÃO',self.page.locator('.scale-provenance').inner_text())
    def test_all_departments_can_save_and_publish_without_mixing_real_history(self):
        self.generate()
        for department,person in [(1,20),(2,21),(3,22),(4,23)]:
            if department!=1:self.scope(department)
            self.assign(person);self.page.locator('[data-b1-action=save]').click();self.publish()
        self.page.locator('[data-demo-view=schedule-calendar]').click();self.page.wait_for_selector('.scale-calendar')
        self.page.locator('#scale-month').fill('2026-10');self.page.locator('#scale-month').dispatch_event('change')
        self.assertEqual(self.page.locator('.scale-chip').count(),4)
        for text in ['Henrique','Mini Lucas','Adriano Borrego']:self.assertNotIn(text,self.page.locator('#app').inner_text())
        self.assertEqual({r['department'] for r in self.page.evaluate('IASDPICalendarSource()')},{'Sonoplastia','Diaconato','Música','Ancionato'})
    def test_edit_draft_preserves_ids_and_published_version_history(self):
        self.generate();self.assign(20);self.page.locator('[data-b1-action=save]').click()
        before=self.page.evaluate('[...IASDPIB1Preview.plans.values()][0]')
        self.page.locator('[name=planTitle]').fill('Rascunho fictício editado');self.page.locator('.b1-requirement [name=notes]').fill('Somente teste')
        self.page.locator('[data-b1-action=save]').click();self.publish()
        after=self.page.evaluate('[...IASDPIB1Preview.plans.values()][0]');self.assertEqual(after['id'],before['id']);self.assertEqual(after['version'],3)
        self.assertEqual(after['requirements'][0]['assignments'][0]['id'],before['requirements'][0]['assignments'][0]['id'])
        self.page.locator('[data-b1-action=version][data-version="1"]').click();self.assertIn('Versão 1',self.page.locator('#app').inner_text())
    def test_extra_event_and_unavailability_is_simulated(self):
        self.page.get_by_text('Adicionar evento extraordinário',exact=True).click();form=self.page.locator('#b1-extra')
        for name,value in [('extraTitle','Evento fictício de teste'),('extraDate','06/10/2026'),('extraStart','18:00'),('extraEnd','19:00')]:form.locator('[name='+name+']').fill(value)
        form.locator('button').click();self.page.wait_for_selector('.b1-event-list input');self.assign(20);self.page.locator('[data-b1-action=save]').click()
        self.assertIn('indisponível',self.page.locator('.b1-status [role=alert]').inner_text())
        self.page.locator('.b1-requirement select').select_option(identifier(21));self.page.locator('[data-b1-action=save]').click();self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),1)
    def test_historical_root_opens_separately_and_is_not_mutated(self):
        before={name:package.sha(self.site/name) for name in package.FILES}
        self.generate();self.assign();self.publish()
        with self.page.expect_popup() as info:self.page.locator('[data-demo-history]').click()
        history=info.value;history.wait_for_selector('.scale-calendar');history.locator('#scale-month').fill('2026-10');history.locator('#scale-month').dispatch_event('change')
        self.assertEqual(len(history.evaluate('IASDPIScheduleCalendar.legacy()')),20)
        self.assertIn('Adriano Borrego',history.locator('.scale-monthly').inner_text());self.assertEqual(history.locator('.scale-chip').count(),18)
        self.assertTrue(history.evaluate('window.opener===null'))
        self.assertEqual({name:package.sha(self.site/name) for name in package.FILES},before)
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),1)
    def test_catalog_navigation_back_forward_deep_link_and_dirty_guard(self):
        self.page.locator('[data-demo-view=schedule-setup]').click();self.page.wait_for_selector('.schedule-tabs')
        for tab in ['people','departments','roles','memberships','availability']:
            self.page.locator('[data-schedule-action=tab][data-id='+tab+']').click();self.assertTrue(self.page.locator('.schedule-list').is_visible())
        self.page.go_back();self.page.wait_for_selector('#b1-scope');self.page.go_forward();self.page.wait_for_selector('.schedule-tabs')
        self.page.goto(self.url+'b1/#schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.page.get_by_role('link',name='Criar escala',exact=True).click();self.page.wait_for_selector('#b1-scope');self.scope(1);self.generate();self.assign()
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-demo-view=schedule-calendar]').click();self.assertEqual(self.page.locator('.b1-requirement').count(),1)
    def test_responsive_keyboard_network_and_memory_isolation(self):
        self.generate();self.assign();self.page.locator('[data-b1-action=save]').click()
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('.b1-demo-help summary').focus();self.page.keyboard.press('Enter');self.assertTrue(self.page.locator('.b1-demo-help').evaluate('(el)=>el.open'))
        self.assertTrue(self.page.evaluate("fetch('/must-not-send').then(()=>false,()=>true)"));self.assertEqual(self.page.evaluate('localStorage.length'),0)
        self.page.reload();self.page.wait_for_selector('#b1-scope');self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),0)
