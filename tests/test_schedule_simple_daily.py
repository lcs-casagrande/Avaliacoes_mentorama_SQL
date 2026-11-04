"""Montagem direta por dia: prévia isolada, preferências e escolha manual."""
from functools import partial
from http.server import ThreadingHTTPServer
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo
import test_schedule_known_people as known

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class SimpleDailyBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,simplified_daily=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    tearDownClass=classmethod(known.KnownPeoplePreviewTests.tearDownClass.__func__)
    setUp=known.KnownPeoplePreviewTests.setUp
    tearDown=known.KnownPeoplePreviewTests.tearDown
    catalog=known.KnownPeoplePreviewTests.catalog
    def person(self,name='Luan'):return next(p for p in self.catalog()['people'] if p['name']==name)
    def open_days(self,name='Luan'):
        person=self.person(name);self.page.get_by_role('link',name='Dias e restrições por voluntário',exact=True).click();self.page.wait_for_selector('#daily-person');self.page.locator('#daily-person').select_option(person['id']);return person,self.page.locator('.daily-person-days')
    def back(self):self.page.get_by_role('link',name='Montar escala',exact=True).click();self.page.wait_for_selector('[data-calendar-volunteer]')
    def fill(self):
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')")
    def test_dropdowns_ready_no_role_step_and_general_membership_not_technical_qualification(self):
        self.assertGreater(self.page.locator('[data-calendar-volunteer]').count(),0)
        self.assertEqual(self.page.locator('#b1-add').count(),0)
        self.assertNotIn('Adicionar função no dia',self.page.locator('main').inner_text())
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.locator('option:not([value=""])').count(),7)
        self.assertTrue(all(not o.evaluate('el=>el.disabled') for o in self.page.locator('[data-calendar-volunteer]').first.locator('option').all()))
        self.assertEqual(self.catalog()['qualifications'],[])
        self.assertEqual(self.catalog()['availability'],[])
        self.assertEqual(self.page.locator('[data-b1-action=layout]').count(),0);self.assertEqual(self.page.locator('#b1-add').count(),0)
    def test_one_click_automatic_fills_and_manual_edit_save_reopen_same_assignment(self):
        self.fill();self.assertEqual(self.page.locator('.monthly-metrics dd').nth(2).inner_text(),'0')
        values=[f.input_value() for f in self.page.locator('[data-calendar-volunteer]').all()];self.assertTrue(all(values));self.assertEqual(len(set(values)),7)
        counts=[values.count(id) for id in set(values)];self.assertLessEqual(max(counts)-min(counts),1)
        self.page.locator('[data-calendar-volunteer]').first.select_option(self.person()['id'])
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        ids=self.page.evaluate('[...IASDPIKnownPreview.plans.values()][0].requirements.map(r=>r.assignments.map(a=>a.id))')
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('[data-calendar-volunteer]');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),self.person()['id']);self.assertEqual(ids,self.page.evaluate('[...IASDPIKnownPreview.plans.values()][0].requirements.map(r=>r.assignments.map(a=>a.id))'))
    def test_restrictions_exclude_from_automatic_but_manual_remains_selectable_and_saves(self):
        person,panel=self.open_days()
        self.assertEqual(panel.locator('[name^=available_]:checked').count(),7)
        for i in range(7):panel.locator('[name=unavailable_'+str(i)+']').check()
        panel.locator('[name=max_monthly_count]').fill('0');panel.locator('button[type=submit]').click();self.page.wait_for_function("document.querySelector('main [role=status]').textContent.includes('simulada')");self.back();self.fill()
        self.assertNotIn(person['id'],[f.input_value() for f in self.page.locator('[data-calendar-volunteer]').all()])
        field=self.page.locator('[data-calendar-volunteer]').first;option=field.locator('option[value="'+person['id']+'"]');self.assertFalse(option.evaluate('el=>el.disabled'));self.assertIn('manual permitido',option.inner_text());field.select_option(person['id'])
        self.assertEqual(self.page.locator('.monthly-metrics dd').nth(4).inner_text(),'0');self.assertEqual(self.page.locator('.monthly-metrics dd').nth(5).inner_text(),'1')
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_function("[...IASDPIKnownPreview.plans.values()].some(p=>p.status==='published')")
    def test_all_restricted_explains_unfilled_slots_instead_of_silent_failure(self):
        self.page.evaluate("IASDPIKnownPreviewSeed.catalog.people.forEach(p=>p.max_monthly_count=0)");self.fill()
        self.assertIn('0 vagas sugeridas',self.page.locator('#b1-feedback').inner_text());self.assertGreater(int(self.page.locator('.monthly-metrics dd').nth(2).inner_text()),0)
        self.assertEqual(self.page.locator('#monthly-day-details').count(),0);self.assertIn('Limite mensal',self.page.locator('[data-calendar-volunteer]').first.inner_text())
    def test_published_other_department_still_blocks_manual_choice(self):
        person=self.person();self.fill();self.page.locator('[data-day="2026-11-07"]').locator('..').locator('[data-calendar-volunteer]').select_option(person['id']);self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_function("[...IASDPIKnownPreview.plans.values()].some(p=>p.status==='published')")
        department=self.page.evaluate("async id=>{const c=await IASDPISchedulePreview.request('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.code==='comunicacao');await IASDPISchedulePreview.request('iasdpi_schedule_save',{p_entity:'membership',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:id,department_id:d.id},p_request_id:crypto.randomUUID()});return d.id;}",person['id'])
        self.page.locator('[data-b1-action=department][data-department="'+department+'"]').click();self.page.wait_for_selector('[data-calendar-volunteer]');option=self.page.locator('[data-calendar-volunteer]').first.locator('option[value="'+person['id']+'"]');self.assertTrue(option.evaluate('el=>el.disabled'));self.assertIn('Conflito',option.inner_text())
    def test_extra_event_gets_dropdown_without_role_step_and_existing_ids_preserved(self):
        before=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)');self.assertEqual(self.page.locator('#b1-extra').count(),0);self.page.evaluate("async()=>{const c=await IASDPISchedulePreview.request('iasdpi_schedule_catalog');await IASDPISchedulePreview.request('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:c.departments.find(d=>d.code==='sonoplastia').id,title:'Evento extraordinário já cadastrado',date:document.querySelector('#b1-scope [name=month]').value+'-02'},p_request_id:crypto.randomUUID()});}");self.page.locator('[data-b1-action=reload]').click()
        self.page.wait_for_function("document.querySelector('[data-day$=\"-02\"]').parentElement.querySelector('[data-calendar-volunteer]')!==null")
        self.assertEqual(before,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
    def test_calendar_keyboard_mobile_and_no_real_requests(self):
        field=self.page.locator('[data-calendar-volunteer]').first;field.focus();self.page.keyboard.press('ArrowDown');self.assertNotEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),'')
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.set_viewport_size({'width':1440,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-simple-daily/calendario-desktop.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-simple-daily/calendario-mobile.png'),full_page=True)
