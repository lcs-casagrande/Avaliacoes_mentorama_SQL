"""Portal público integrado, isolado de Supabase e do módulo privado de cultos."""
import base64
from functools import partial
import hashlib
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

CRONO='https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home'

class PortalPackageTests(unittest.TestCase):
    def test_public_bundle_integrity_no_database_no_private_auth_client(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);manifest=demo.builder.build(out,church_portal=True)
            self.assertTrue(manifest['church_portal']);self.assertFalse(manifest['database_connected']);self.assertFalse(manifest['remote_requests_allowed'])
            self.assertEqual(set(p.name for p in out.iterdir()),{'index.html','styles.css','demo.js','manifest.json','.nojekyll'})
            html=(out/'index.html').read_text();script=(out/'demo.js').read_text()
            self.assertIn("connect-src 'none'",html)
            self.assertIn('href="#church-home" data-demo-view="church-home"',html)
            for name,digest in manifest['files'].items():self.assertEqual(hashlib.sha256((out/name).read_bytes()).hexdigest(),digest)
            for name in ['styles.css','demo.js']:self.assertIn('sha256-'+base64.b64encode(hashlib.sha256((out/name).read_bytes()).digest()).decode(),html)
            all_text=''.join(p.read_text() for p in out.iterdir()).replace(CRONO,'')
            self.assertNotRegex(all_text,r'https?://|sb_publishable_|sb_secret_|service_role|postgresql://|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY')
            self.assertNotIn('supabase.createClient',script);self.assertNotIn('iasdpi-cloud-config',script)
            self.assertNotIn('iasdpi-demo-v1',script);self.assertNotIn('culto_archives',script)
    def test_standalone_integrity_and_legacy_mode_stays_isolated(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'site';demo.builder.build(out,church_portal=True);target=Path(tmp)/'portal.html';demo.builder.standalone(out,target)
            html=target.read_text();scripts=re.findall(r'<script>(.*?)</script>',html,re.S);self.assertEqual(len(scripts),1)
            self.assertIn('sha256-'+base64.b64encode(hashlib.sha256(scripts[0].encode()).digest()).decode(),html)
            legacy=Path(tmp)/'legacy';demo.builder.build(legacy,review_ready=True)
            self.assertNotIn('IASDPIChurchPortal.page',(legacy/'demo.js').read_text());self.assertNotIn(CRONO,(legacy/'index.html').read_text())

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class PortalBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,church_portal=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url));self.page.goto(self.url);self.page.wait_for_selector('.church-portal-cards')
    def tearDown(self):
        try:self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests))
        finally:self.context.close()
    def nav(self,route):
        if route=='agendas':self.page.locator('header summary').click()
        target=self.page.locator('[data-demo-view="'+route+'"]').first
        target.click();self.page.wait_for_function('(route)=>state.page===route',arg=route)
    def build(self):self.nav('schedule-calendar');self.nav('schedule-build');self.page.wait_for_selector('[data-calendar-volunteer]')
    def test_public_routes_no_auth_forms_and_one_church_identity(self):
        self.assertEqual(self.page.locator('h1').inner_text(),'Parada Inglesa')
        for route,selector in [('schedule-calendar','.scale-calendar'),('organization','#organization-results'),('agendas','.agenda-calendar')]:
            self.nav(route);self.page.wait_for_selector(selector);self.assertEqual(self.page.locator('input[type=password],#auth-login-form').count(),0)
        self.assertEqual(self.page.locator('.schedule-brand-copy small').inner_text(),'Parada Inglesa')
        self.page.locator('.schedule-brand').click();self.page.wait_for_selector('.church-portal-cards')
    def test_chrono_is_explicit_protected_existing_module_without_real_request(self):
        anchors=self.page.locator('a[href="'+CRONO+'"]');self.assertEqual(anchors.count(),2)
        for anchor in anchors.all():
            self.assertEqual(anchor.get_attribute('target'),'_blank');self.assertIn('noopener',anchor.get_attribute('rel'));self.assertIn('com login',anchor.get_attribute('aria-label'))
        self.assertIn('Com login',self.page.locator('.church-portal-cards').inner_text())
        self.page.get_by_role('button',name='Sobre este portal',exact=True).click();self.assertIn('somente nesta aba',self.page.locator('#schedule-storage-help').inner_text());self.assertIn('módulo oficial',self.page.locator('#schedule-storage-help').inner_text())
    def test_original_organization_ministries_and_search_preserved(self):
        self.nav('organization');self.assertTrue(self.page.evaluate("churchMinistries.length===26&&churchMinistries.every(m=>[...document.querySelectorAll('[data-ministry]')].some(e=>e.dataset.ministry===m.name))"));self.assertEqual(self.page.locator('.organization-elder').count(),9)
        self.assertIn('Luciano',self.page.locator('.organization-pastor').inner_text());self.page.locator('#organization-query').fill('família');self.assertEqual(self.page.locator('[data-ministry]').count(),1);self.assertIn('Luana e Raphael',self.page.locator('#organization-results').inner_text())
        self.page.get_by_role('button',name='Limpar pesquisa',exact=True).click();self.assertTrue(self.page.evaluate("churchMinistries.length===26&&churchMinistries.every(m=>[...document.querySelectorAll('[data-ministry]')].some(e=>e.dataset.ministry===m.name))"))
    def test_agenda_original_sources_manual_schedules_and_month_navigation(self):
        self.nav('agendas');self.assertEqual(self.page.locator('.portal-source').get_attribute('data-source'),'official')
        self.page.locator('#agenda-area').select_option('sound');self.assertEqual(self.page.locator('.portal-source').get_attribute('data-source'),'manual')
        self.page.locator('[data-month-open]').click();self.page.get_by_role('button',name='Outubro',exact=True).click();self.assertEqual(self.page.locator('#agenda-month-picker').input_value(),'2026-10');self.assertEqual(self.page.locator('.ministry-shift').count(),13)
        self.page.get_by_role('button',name='Próximo mês',exact=True).click();self.assertEqual(self.page.locator('.ministry-shift').count(),2)
        self.page.get_by_role('button',name='Mês anterior',exact=True).click();self.page.locator('#agenda-area').select_option('communication');self.assertEqual(self.page.locator('.ministry-shift').count(),5);self.assertIn('macedo Logos',self.page.locator('.agenda-list').inner_text())
        self.page.locator('#agenda-show-people').uncheck();self.assertNotIn('macedo Logos',self.page.locator('.agenda-list').inner_text());self.page.locator('#agenda-show-people').check()
    def test_agenda_official_filter_list_and_calendar_day_interactions(self):
        self.nav('agendas');self.page.get_by_role('button',name='Lista',exact=True).click();self.assertEqual(self.page.locator('.agenda-calendar').count(),0)
        self.page.locator('#agenda-department').select_option(index=1);self.assertEqual(self.page.locator('#agenda-department').input_value(),self.page.locator('#agenda-department option').nth(1).get_attribute('value'))
        self.page.get_by_role('button',name='Calendário',exact=True).click();day=self.page.locator('.calendar-day').first;day.click();self.assertEqual(self.page.locator('.calendar-day[aria-pressed=true]').count(),1)
    def test_direct_links_reload_history_and_active_navigation(self):
        self.nav('organization');self.nav('schedule-calendar');self.nav('schedule-members');self.page.wait_for_selector('.daily-member-table')
        self.assertEqual(self.page.locator('header [data-demo-view=schedule-calendar]').get_attribute('aria-current'),'page');self.assertEqual(self.page.locator('.portal-module-nav [data-demo-view=schedule-members]').get_attribute('aria-current'),'page')
        self.page.go_back();self.page.wait_for_selector('.scale-calendar');self.page.go_back();self.page.wait_for_selector('#organization-query');self.page.go_forward();self.page.wait_for_selector('.scale-calendar');self.page.reload();self.page.wait_for_selector('.scale-calendar');self.assertEqual(self.page.url,self.url+'#schedule-calendar')
        self.page.goto(self.url+'#agendas');self.page.wait_for_selector('.agenda-toolbar');self.assertEqual(self.page.locator('header summary').get_attribute('aria-current'),'page')
    def test_unsaved_changes_guard_and_saved_draft_preserved_across_public_pages(self):
        self.build();field=self.page.locator('[data-calendar-volunteer]').first;person=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(person)
        self.page.once('dialog',lambda d:d.dismiss());self.nav_button=self.page.locator('header [data-demo-view=organization]');self.nav_button.click();self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),person);self.assertEqual(self.page.url,self.url+'#schedule-build')
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback').textContent.includes('salvas nesta aba')")
        self.nav('organization');self.nav('schedule-calendar');self.nav('schedule-build');self.page.wait_for_selector('[data-calendar-volunteer]');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),person)
    def test_public_calendar_keeps_all_historical_sources(self):
        self.nav('schedule-calendar');legacy=self.page.evaluate('IASDPIKnownPreview.legacy');self.assertEqual(len(legacy),20);self.assertEqual(len({(r['person_id'],r['department_id'],r['date']) for r in legacy}),20)
        self.assertEqual(self.page.evaluate("IASDPICalendarOfficialSource().events.filter(e=>e.kind==='weekly'||e.kind==='monthly').length"),self.page.evaluate("IASDPIAgendaData.events.filter(e=>e.kind==='weekly'||e.kind==='monthly').length"))
        self.nav('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('.schedule-summary').count(),1)
        music=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.departments.find(d=>d.code==='musica').id");self.page.locator('[data-b1-action=department][data-department="'+music+'"]').click();self.page.wait_for_selector('.music-team');self.assertEqual(self.page.locator('.music-team').first.locator('[data-music-volunteer]').count(),1)
    def test_mobile_five_widths_and_keyboard_menu(self):
        evidence=base.ROOT/'dist/church-portal';evidence.mkdir(parents=True,exist_ok=True)
        for route,selector in [('church-home','.church-portal-cards'),('organization','.organization-pastor'),('agendas','.agenda-calendar'),('schedule-calendar','.scale-calendar'),('schedule-build','.monthly-calendar')]:
            self.nav(route);self.page.wait_for_selector(selector)
            for width in [360,390,768,1024,1440]:
                self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width,route+' '+str(width))
                for button in self.page.locator('.schedule-primary-nav>button,header summary').all():self.assertGreaterEqual(button.bounding_box()['height'],44)
            for width,label in [(390,'mobile'),(1440,'desktop')]:self.page.set_viewport_size(dict(width=width,height=900));self.page.screenshot(path=str(evidence/f'{route}-{label}.png'),full_page=True)
        self.page.locator('header summary').focus();self.page.keyboard.press('Enter');self.assertTrue(self.page.get_by_role('button',name='Agenda',exact=True).is_visible());self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('.schedule-nav-more').evaluate('e=>e.open'));self.assertTrue(self.page.locator('header summary').evaluate('e=>e===document.activeElement'))
