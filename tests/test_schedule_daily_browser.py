"""Prévia B1.1: interface real e RPC fictícia, sem Supabase remoto."""
from functools import partial
from http.server import ThreadingHTTPServer
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo
import test_schedule_foundation_browser as foundation

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class DailyScheduleBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,daily_preview=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url));self.page.goto(self.url);self.page.wait_for_selector('#b1-scope')
    def tearDown(self):self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests));self.context.close()
    def navigate(self,page):self.page.locator('[data-demo-view='+page+']').click()
    def profile(self):
        self.navigate('schedule-members');self.page.wait_for_selector('.daily-member-table');row=self.page.locator('[data-member="00000000-0000-4000-8000-000000000020"]')
        for day in range(7):row.locator('[name=available_'+str(day)+']').check()
        row.locator('button[type=submit]').click();self.page.wait_for_function("document.querySelector('[data-member-status]') && document.querySelector('[data-member-status]').textContent!== 'Alterações pendentes'")
        self.navigate('schedule-build');self.page.wait_for_selector('#b1-scope')
    def generate(self):self.page.locator('#b1-recurring button').click();self.page.wait_for_selector('.b1-event-list input')
    def assign(self):self.page.locator('.b1-event-list input').first.check();self.page.locator('#b1-add button').click()
    def test_next_month_default_no_time_fields_and_never_current_generation(self):
        self.assertEqual(self.page.locator('[name=start],[name=end]').count(),0)
        config=self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_settings_get')")
        self.assertEqual(self.page.locator('#b1-scope [name=month]').input_value(),config['future_months'][0][:7])
        self.generate();events=self.page.evaluate('IASDPIB1Preview.events');self.assertTrue(all(e['scheduled_on'][:7]>config['today'][:7] for e in events));self.assertTrue(all(e['starts_at'] is None for e in events))
    def test_unknown_disabled_then_flags_enable_and_save_without_hours(self):
        self.generate();self.assign();self.assertTrue(self.page.locator('.b1-requirement option[value="00000000-0000-4000-8000-000000000020"]').evaluate('(option)=>option.disabled'));self.page.locator('.b1-requirement select').focus();self.page.keyboard.press('ArrowDown');self.assertEqual(self.page.locator('.b1-requirement select').input_value(),'')
        self.page.once('dialog',lambda d:d.accept());self.profile();self.generate();self.assign()
        self.page.locator('.b1-requirement select').first.select_option('00000000-0000-4000-8000-000000000020');self.page.locator('[data-b1-action=save]').click()
        row=self.page.evaluate('[...IASDPIB1Preview.plans.values()][0].requirements[0].assignments[0]');self.assertEqual(row['timing_mode'],'day');self.assertIsNone(row['starts_at'])
        day=self.page.evaluate('new Date([...IASDPIB1Preview.plans.values()][0].requirements[0].assignments[0].assigned_on+"T12:00:00Z").getUTCDay()')
        self.navigate('schedule-members');self.page.wait_for_selector('.daily-member-table');member=self.page.locator('[data-member="00000000-0000-4000-8000-000000000020"]');member.locator('[name=available_'+str(day)+']').uncheck();member.locator('button[type=submit]').click();self.assertIn('Disponibilidade',member.locator('[data-member-status]').inner_text())
    def test_admin_settings_months_days_and_extra_dates(self):
        self.navigate('schedule-settings');self.page.wait_for_selector('#daily-settings')
        self.page.locator('[name=planning_months]').select_option('3')
        for checkbox in self.page.locator('#daily-settings [name=weekday]').all():checkbox.uncheck()
        self.page.locator('#daily-settings [name=weekday][value="1"]').check();self.page.locator('#daily-settings button').click()
        config=self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_settings_get')");self.assertEqual(len(config['future_months']),3);self.assertEqual(config['weekdays'],[1])
        self.navigate('schedule-build');self.page.wait_for_selector('#b1-scope');self.generate();events=self.page.evaluate('IASDPIB1Preview.events');self.assertTrue(events)
    def test_member_sheet_same_people_multiple_departments_and_flags_unknown(self):
        self.navigate('schedule-members');self.page.wait_for_selector('.daily-member-table')
        self.assertEqual(self.page.locator('[data-member]').count(),4)
        row=self.page.locator('[data-member="00000000-0000-4000-8000-000000000020"]');self.assertIn('Sonoplastia',row.inner_text());self.assertIn('Música',row.inner_text());self.assertEqual(row.locator('[type=checkbox]:checked').count(),1)
        row.locator('[name=available_3]').check();row.locator('[name=unavailable_3]').check();self.assertFalse(row.locator('[name=available_3]').is_checked())
    def test_member_pending_other_row_survives_save_and_history(self):
        self.navigate('schedule-members');self.page.wait_for_selector('.daily-member-table');rows=self.page.locator('[data-member]')
        name=rows.nth(1).locator('[name=name]');name.fill('Pessoa Beta fictícia editada');rows.first.locator('[name=available_3]').check();rows.first.locator('button[type=submit]').click()
        self.assertEqual(rows.nth(1).locator('[name=name]').input_value(),'Pessoa Beta fictícia editada');self.assertTrue(rows.nth(1).locator('button[type=submit]').is_enabled())
        rows.first.locator('[data-daily-action=history]').click();self.page.wait_for_selector('#daily-history');self.assertEqual(rows.nth(1).locator('[name=name]').input_value(),'Pessoa Beta fictícia editada')
    def test_responsive_sheet_local_scroll_and_navigation_pending_guard(self):
        self.navigate('schedule-members');self.page.wait_for_selector('.daily-member-table')
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.assertTrue(self.page.locator('.daily-member-scroll').evaluate('(el)=>el.scrollWidth>el.clientWidth'))
        self.page.locator('[data-member]').first.locator('[name=available_3]').check();self.page.once('dialog',lambda d:d.dismiss());self.navigate('schedule-build');self.assertTrue(self.page.locator('.daily-member-table').is_visible())

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class DailyFullFrontendTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    setUp=foundation.ScheduleFoundationBrowserTests.setUp
    tearDown=base.FrontendAccessTests.tearDown
    def supabase(self,route):
        path=route.request.url.split('/rest/v1/rpc/')[-1]
        settings={'can_edit':self.role=='admin','daily':True,'planning_months':2,'weekdays':[0,3,6],'extra_dates':[],'version':1,'future_months':['2026-11-01','2026-12-01']}
        if path=='iasdpi_schedule_settings_get':route.fulfill(json=settings);return
        if path=='iasdpi_schedule_members':
            if self.role=='admin':route.fulfill(json={'catalog':self.catalog,'members':[]})
            else:route.fulfill(status=403,json={'code':'42501','message':'Somente administrador.'})
            return
        if path=='iasdpi_schedule_workspace':route.fulfill(json={'plan':None,'events':[],'versions':[],'settings':settings,'availability':[]});return
        if path=='iasdpi_schedule_exceptions':route.fulfill(json=[]);return
        foundation.ScheduleFoundationBrowserTests.supabase(self,route)
    def login(self):
        self.page.goto(self.base+'#schedule-build');self.page.wait_for_selector('#b1-login');self.page.locator('#b1-login [name=email]').fill('test@example.invalid');self.page.locator('#b1-login [name=password]').fill('correct-password');self.page.locator('#b1-login button').click();self.page.wait_for_selector('#b1-scope')
    def test_identity_login_opens_admin_sheet_and_settings_without_new_login(self):
        self.login();self.page.locator('[data-b1-nav=schedule-members]').click();self.page.wait_for_selector('.daily-member-table')
        self.page.locator('[data-b1-nav=schedule-settings]').click();self.page.wait_for_selector('#daily-settings')
        self.assertEqual(self.page.locator('input[type=password]').count(),0)
    def test_non_admin_cannot_open_sheet_even_with_direct_link(self):
        self.role='leader';self.catalog['is_admin']=False;self.login();self.page.goto(self.base+'#schedule-members');self.page.wait_for_selector('[role=alert]')
        self.assertEqual(self.page.locator('.daily-member-table').count(),0);self.assertEqual(self.page.locator('#daily-settings').count(),0)
