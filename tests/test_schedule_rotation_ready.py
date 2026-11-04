"""Exemplo isolado: botão utilizável ao abrir, sem preparação manual ou rede."""
from functools import partial
from http.server import ThreadingHTTPServer
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class RotationReadyPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name+'/site',rotation_ready=True);demo.builder.standalone(cls.tmp.name+'/site',cls.tmp.name+'/preview.html')
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.remote=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.remote.append(r.url) if not r.url.startswith(self.url) else None);self.page.goto(self.url+'preview.html');self.page.wait_for_selector('.monthly-calendar')
    def tearDown(self):self.assertEqual(self.errors,[]);self.assertEqual(self.remote,[]);self.context.close()
    def test_first_click_fills_month_without_manual_setup_or_auto_publish(self):
        self.assertTrue(self.page.locator('[data-b1-action=prefill]').is_enabled());self.assertGreater(int(self.page.locator('.monthly-metrics dd').first.inner_text()),0);self.assertEqual(self.page.locator('.monthly-metrics dd').nth(1).inner_text(),'0')
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')")
        self.assertEqual(self.page.locator('.monthly-metrics dd').nth(2).inner_text(),'0');self.assertGreater(self.page.locator('.monthly-name').count(),0)
        self.assertTrue(self.page.evaluate('[...IASDPIB1Preview.plans.values()].filter(p=>p.month===document.querySelector("#b1-scope [name=month]").value+"-01").every(p=>p.status==="draft"&&p.requirements.every(r=>r.assignments.length===0))'))
    def test_four_departments_ready_and_mobile_without_horizontal_overflow(self):
        for button in self.page.locator('.monthly-departments button').all():
            button.click();self.page.wait_for_selector('.monthly-calendar');self.assertTrue(self.page.locator('[data-b1-action=prefill]').is_enabled());self.assertGreater(int(self.page.locator('.monthly-metrics dd').first.inner_text()),0)
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
