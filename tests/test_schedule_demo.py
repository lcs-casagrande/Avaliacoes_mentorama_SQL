"""Prévia isolada: dados fictícios, UI real e conexões bloqueadas."""
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base

spec=importlib.util.spec_from_file_location('demo_builder',base.ROOT/'scripts/build_schedule_demo.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class ScheduleDemoPackageTests(unittest.TestCase):
    def test_no_real_data_config_or_backend_in_artifact(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'site';builder.build(out)
            text=''.join(p.read_text() for p in out.iterdir())
            for value in ['https://','sb_publishable_','sb_secret_','Luan','Marciano','Rose','Alexandre','createClient']:
                self.assertNotIn(value,text)
            # Código reutilizável pode consultar globais opcionais; a demo não deve defini-las.
            self.assertNotRegex(text,r'(?:window\.)?(?:ministrySchedules|IASDPIConfig)\s*=\s*(?:Object\.freeze\(|[\[{])')
            self.assertIn("connect-src 'none'",text);self.assertIn("form-action 'none'",text)
            self.assertIn('DEMONSTRAÇÃO — DADOS FICTÍCIOS',text)
            self.assertEqual({p.name for p in out.iterdir()},{'index.html','styles.css','demo.js','manifest.json','.nojekyll'})
    def test_builder_does_not_overwrite_existing_package(self):
        with tempfile.TemporaryDirectory() as temp:
            builder.build(temp)
            with self.assertRaises(ValueError):builder.build(temp)

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ScheduleDemoBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();builder.build(cls.temp.name)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.temp.name))
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
        cls.url='http://127.0.0.1:'+str(cls.http.server_port)+'/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.temp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.requests=[];self.errors=[]
        self.page.on('request',lambda r:self.requests.append(r.url));self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.goto(self.url);self.page.wait_for_selector('.schedule-list')
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.assertTrue(all(u.startswith(self.url) for u in self.requests));self.context.close()
    def tab(self,key):self.page.locator('[data-schedule-action="tab"][data-id="'+key+'"]').click()
    def test_all_catalogs_navigate_without_login(self):
        for key in ['people','departments','roles','memberships','availability','access','sources']:
            self.tab(key);self.assertIn('Cadastros de escalas',self.page.locator('h1').inner_text())
        self.assertEqual(self.page.locator('input[type=password]').count(),0)
    def test_create_edit_qualification_and_reload_resets_fictional_state(self):
        self.page.locator('[data-schedule-action="create"]').click();self.page.get_by_label('Nome completo',exact=True).fill('Pessoa de teste descartável');self.page.get_by_label('Nome de exibição',exact=True).fill('Teste descartável')
        self.page.locator('#schedule-editor button[type=submit]').click();self.page.wait_for_selector('#schedule-editor',state='detached')
        self.assertIn('Teste descartável',self.page.locator('.schedule-list').inner_text())
        self.tab('memberships');self.page.locator('[data-schedule-action="edit"]').first.click()
        self.page.get_by_label('Operação de áudio — exemplo',exact=True).check();self.page.locator('#schedule-editor button[type=submit]').click();self.page.wait_for_selector('#schedule-editor',state='detached')
        self.page.reload();self.page.wait_for_selector('.schedule-list');self.assertNotIn('Teste descartável',self.page.locator('.schedule-list').inner_text())
    def test_network_and_storage_isolation(self):
        result=self.page.evaluate("async()=>{let blocked=false;try{await fetch('/must-never-be-requested')}catch(_){blocked=true}return {blocked,storage:localStorage.length,auth:typeof window.supabase};}")
        self.assertEqual(result,{'blocked':True,'storage':0,'auth':'undefined'})
        self.assertEqual(self.page.evaluate('[typeof ministrySchedules,typeof IASDPIConfig]'),['undefined','undefined'])
        self.assertFalse(any('must-never' in u for u in self.requests))
    def test_five_viewports_all_forms_no_overflow(self):
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            for key in ['people','departments','roles','memberships','availability']:
                self.tab(key);self.page.locator('[data-schedule-action="create"]').click()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.page.locator('[data-schedule-action="cancel"]').click()
