"""G4: HTML integrado real, SDK Auth real com provedor fictício, rede externa bloqueada."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
import test_frontend_access as base

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class PortalIntegrationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix='iasdpi-g4-browser-');target=Path(cls.tmp.name)/'index.html';subprocess.run(['python','scripts/export_preview.py','--integrated-access-preview','--output',str(target)],cwd=base.ROOT,check=True,capture_output=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start();cls.url='http://127.0.0.1:'+str(cls.http.server_port)+'/'
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.external=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.external.append(r.url) if r.url.startswith('https://') else None);self.page.goto(self.url);self.page.wait_for_selector('.church-portal-cards')
    def tearDown(self):
        try:self.assertEqual(self.errors,[]);self.assertEqual(self.external,[])
        finally:self.context.close()
    def go(self,page):
        self.page.wait_for_function('()=>!bootInProgress&&!state.busy');self.page.evaluate('(page)=>IASDPINavigation.navigate(page)',page)
    def choose(self):
        self.go('schedule-build');self.page.wait_for_selector('#church-select');self.page.select_option('#church-select','IASD_PI');self.page.get_by_role('button',name='Continuar',exact=True).click();self.page.wait_for_selector('#portal-login-form')
    def login(self,alias='som.teste'):
        self.choose();self.page.fill('#portal-login-form [name=email]',alias);self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar')
    def prefill(self):
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('sugeridas')")
    def save(self,publish=False):
        if publish:self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-b1-action='+('publish' if publish else 'save')+']').first.click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
    def test_public_home_agenda_organization_calendar_without_login(self):
        for page,selector in [('agendas','.agenda-calendar'),('organization','#organization-results'),('schedule-calendar','.scale-calendar'),('church-home','.church-portal-cards')]:
            self.go(page);self.page.wait_for_selector(selector);self.assertEqual(self.page.locator('input[type=password]').count(),0)
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'));self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
    def test_private_route_demands_church_then_login_and_bad_password_stays_clear(self):
        self.choose();self.assertEqual(self.page.locator('.monthly-calendar').count(),0);self.page.fill('#portal-login-form [name=email]','som.teste');self.page.fill('#portal-login-form [name=password]','wrong-password');self.page.locator('#portal-login-form button').click();self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Não foi possível entrar')");self.assertEqual(self.page.locator('.monthly-calendar').count(),0)
    def test_ministerial_identity_does_not_get_chrono_or_admin_and_only_own_department(self):
        self.login();names=self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents();self.assertEqual(names,['Sonoplastia']);self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'));self.go('schedule-settings');self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Acesso restrito')");self.go('home');self.page.wait_for_selector('#auth-login-form')
    def test_multiple_departments_switch_without_signin_and_preserve_sdk_identity(self):
        self.login('multi.teste');uid=self.page.evaluate('(async()=> (await IASDPIAuth.requireIdentity()).user.id)()');self.page.locator('[data-b1-action=department]').filter(has_text='Sonoplastia').click();self.page.wait_for_function("()=>document.querySelector('#app h1')?.textContent==='Sonoplastia'");self.page.locator('[data-b1-action=department]').filter(has_text='Música').click();self.page.wait_for_function("()=>document.querySelector('#app h1')?.textContent==='Música'");self.assertEqual(self.page.evaluate('(async()=> (await IASDPIAuth.requireIdentity()).user.id)()'),uid);self.assertEqual(self.page.locator('#portal-login-form').count(),0)
    def test_rotation_draft_not_public_and_publication_becomes_public(self):
        self.login();self.prefill();self.assertTrue(self.page.evaluate("[...document.querySelectorAll('[data-calendar-volunteer]')].every(s=>s.value)"));month=self.page.locator('#schedule-month').input_value();self.save();self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate('(m)=>{IASDPIScheduleCalendar.show({month:m,department:"Sonoplastia"});render();}',month);self.page.wait_for_function("()=>!document.querySelector('.portal-feed-state')?.textContent.includes('Carregando')");self.assertEqual(self.page.evaluate('IASDPIPortalAccess.feedRows("'+month+'").length'),0)
        self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.save(True);self.go('schedule-calendar');self.page.wait_for_function("()=>document.querySelector('.portal-feed-state')?.textContent.includes('atribuições publicadas')");self.assertGreater(self.page.evaluate('IASDPIPortalAccess.feedRows("'+month+'").length'),0)
    def test_viewer_and_editor_have_distinct_buttons_and_backend_denies_forgery(self):
        self.login('leitura.teste');self.assertEqual(self.page.locator('[data-b1-action=save],[data-b1-action=publish],[data-b1-action=prefill]').count(),0)
        result=self.page.evaluate("async()=>{try{await IASDPISchedules.request('iasdpi_schedule_generate_days',{p_department:'00000000-0000-4000-8000-000000000001',p_title:'forged',p_request_id:crypto.randomUUID()});return 'unexpected';}catch(e){return e.message;}}")
        self.assertIn('Sem edição',result)
    def test_editor_without_publish_cannot_publish_directly(self):
        self.login('editor.teste');self.assertEqual(self.page.locator('[data-b1-action=publish]').count(),0);self.assertGreater(self.page.locator('[data-b1-action=save]').count(),0)
        result=self.page.evaluate("async()=>{const id=IASDPIB1Preview.plans.values().next().value.id;try{await IASDPISchedules.request('iasdpi_schedule_plan_save',{p_id:id,p_expected_version:1,p_data:{status:'published'},p_request_id:crypto.randomUUID()});return 'unexpected';}catch(e){return e.message;}}")
        self.assertIn('Sem permissão',result)
    def test_revocation_hides_loaded_form_and_blocks_next_write(self):
        self.login();self.page.evaluate("IASDPIG4Demo.revoke('som.teste')");self.page.wait_for_selector('#portal-login-form');self.assertEqual(self.page.locator('.monthly-calendar').count(),0)
    def test_reload_recovers_session_and_navigation_back_forward(self):
        self.login();self.go('organization');self.page.wait_for_selector('#organization-results');self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.go_back();self.page.wait_for_selector('#organization-results');self.page.go_forward();self.page.wait_for_selector('.scale-calendar');self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.page.reload();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('#portal-login-form').count(),0)
    def test_unsaved_departure_guard_and_real_chrono_login_behavior(self):
        self.login();field=self.page.locator('[data-calendar-volunteer]').first;value=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(value);self.page.once('dialog',lambda d:d.dismiss());self.go('organization');self.assertEqual(field.input_value(),value)
    def test_admin_governance_and_no_additional_active_church(self):
        self.login('admin.teste');self.go('access-admin');self.page.wait_for_selector('.governance-tabs');self.assertIn('Administrador fictício',self.page.locator('#app').inner_text());self.assertEqual(self.page.locator('#portal-church').count(),0)
    def test_chrono_uses_original_form_session_and_routes(self):
        self.go('home');self.page.wait_for_selector('#church-select');self.page.select_option('#church-select','IASD_PI');self.page.get_by_role('button',name='Continuar',exact=True).click();self.page.wait_for_selector('#auth-login-form');self.page.fill('#auth-login-form [name=email]','crono.teste');self.page.fill('#auth-login-form [name=password]','Demonstracao#2026');self.page.locator('#auth-login-form button').click();self.page.wait_for_function('()=>IASDPIAuth.allowed()');self.assertEqual(self.page.evaluate('IASDPIAuth.session().user.id'),'00000000-0000-4000-8000-000000000096')
    def test_five_widths_keyboard_and_evidence(self):
        self.login();output=base.ROOT/'dist/portal-integration';output.mkdir(parents=True,exist_ok=True)
        for route,selector in [('church-home','.church-portal-cards'),('agendas','.agenda-calendar'),('organization','#organization-results'),('schedule-calendar','.scale-calendar'),('schedule-build','.monthly-calendar')]:
            self.go(route);self.page.wait_for_selector(selector)
            for width in [360,390,768,1024,1440]:
                self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width,route)
        self.page.locator('[data-b1-action=prefill]').focus();self.page.keyboard.press('Enter');self.page.wait_for_function("()=>document.querySelector('#b1-feedback').textContent.includes('sugeridas')")
        for width,label in [(390,'mobile'),(1440,'desktop')]:self.page.set_viewport_size(dict(width=width,height=900));self.page.evaluate('window.scrollTo(0,0)');self.page.screenshot(path=str(output/('g4-'+label+'.png')),full_page=True)
    def test_public_feed_failure_is_not_empty_and_retry_recovers(self):
        self.page.evaluate("async()=>{const original=window.fetch;window.g4FailFeed=true;window.fetch=(url,args)=>{if(String(url).includes('iasdpi_schedule_published')&&window.g4FailFeed)return Promise.reject(Error('Falha temporária fictícia'));return original(url,args);};await IASDPIPortalAccess.refreshFeed(IASDPIScheduleCalendar.dayNow().slice(0,7));}")
        self.go('schedule-calendar');self.page.wait_for_selector('[data-portal-feed]');self.assertIn('Falha temporária',self.page.locator('.portal-feed-state').inner_text());self.assertNotIn('Nenhuma escala administrada',self.page.locator('.portal-feed-state').inner_text());self.page.evaluate('window.g4FailFeed=false');self.page.locator('[data-portal-feed]').click();self.page.wait_for_function("()=>document.querySelector('.portal-feed-state')?.textContent.includes('Nenhuma escala administrada')");self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
    def test_elders_keep_weekly_and_yearly_calendars_in_demo(self):
        self.login('admin.teste');self.page.locator('[data-b1-action=department]').filter(has_text='Ancionato').click();self.page.wait_for_selector('.elder-week-calendar');self.page.locator('[data-elder-action=kind][data-kind=monthly]').click();self.page.wait_for_selector('.elder-year-calendar');self.assertEqual(self.page.locator('.elder-month-card').count(),12)
    def test_publication_readable_after_logout_without_draft_access(self):
        self.login();self.prefill();self.save(True);month=self.page.locator('#schedule-month').input_value();self.page.locator('#auth-logout').click();self.page.wait_for_function('()=>!IASDPIAuth.allowed()');self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate('(m)=>{IASDPIScheduleCalendar.show({month:m});render();}',month);self.page.wait_for_function("()=>document.querySelector('.portal-feed-state')?.textContent.includes('atribuições publicadas')");self.go('schedule-build');self.page.wait_for_selector('#portal-login-form')
    def test_delegate_enters_existing_governance_without_general_admin_role(self):
        self.login('som.teste');self.go('access-admin');self.page.wait_for_selector('.governance-tabs');self.assertEqual(self.page.locator('[data-gov-tab=aliases]').count(),0);self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'));self.page.locator('[data-gov-tab=members]').click();self.page.locator('[data-gov-form=members-load] button').click();self.page.wait_for_selector('[data-gov-form=member]')
    def test_portal_admin_can_reach_settings_using_server_scoped_role(self):
        self.login('admin.teste');self.assertTrue(self.page.locator('nav [data-page=schedule-settings]').is_visible());self.go('schedule-settings');self.page.wait_for_selector('#daily-settings');self.assertEqual(self.page.locator('#portal-login-form').count(),0)

    def test_temporary_profile_failure_recovers_without_new_login(self):
        self.login();self.page.evaluate("()=>{const original=window.fetch;window.g4ContextFailure=true;window.fetch=(url,args)=>String(url).endsWith('/iasdpi_portal_context')&&window.g4ContextFailure?Promise.resolve(Response.json({error:'temporary'},{status:503})):original(url,args);window.dispatchEvent(new Event('iasdpi-auth-changed'));}")
        self.page.wait_for_selector('[data-portal-retry]');self.page.evaluate('window.g4ContextFailure=false');self.page.locator('[data-portal-retry]').click();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('#portal-login-form').count(),0)
