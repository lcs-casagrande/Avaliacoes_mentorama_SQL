"""Apresentação compacta de homologação; mesma base e contratos isolados das escalas."""
from functools import partial
from http.server import ThreadingHTTPServer
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo
import test_schedule_known_people as known

class ReviewPackageTests(unittest.TestCase):
    def test_package_keeps_csp_integrity_and_has_no_credentials_or_external_connections(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);m=demo.builder.build(out,review_ready=True);self.assertTrue(m['review_ready']);self.assertFalse(m['database_connected']);self.assertFalse(m['remote_requests_allowed'])
            text=''.join(p.read_text() for p in out.iterdir());self.assertNotRegex(text,r'https?://|sb_publishable_|sb_secret_|postgresql://|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY')
            html=(out/'index.html').read_text();self.assertIn("connect-src 'none'",html);self.assertNotIn('Navegação B1.2',html);self.assertNotIn('demo-label',html)
            for name,digest in m['files'].items():self.assertEqual(hashlib.sha256((out/name).read_bytes()).hexdigest(),digest)
            for name in ['demo.js','styles.css']:self.assertIn('sha256-'+base64.b64encode(hashlib.sha256((out/name).read_bytes()).digest()).decode(),html)
    def test_clean_mode_never_hides_fictional_scenario_identification(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):demo.builder.build(tmp,review_ready=True,confirmation_test=True)

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ReviewBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,review_ready=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    tearDownClass=classmethod(known.KnownPeoplePreviewTests.tearDownClass.__func__)
    setUp=known.KnownPeoplePreviewTests.setUp
    tearDown=known.KnownPeoplePreviewTests.tearDown
    catalog=known.KnownPeoplePreviewTests.catalog
    def department(self,code):
        d=next(d for d in self.catalog()['departments'] if d['code']==code);self.page.locator('[data-b1-action=department][data-department="'+d['id']+'"]').click();self.page.wait_for_selector('.elder-week-calendar' if code=='ancionato' else '[data-calendar-volunteer]');return d
    def clean_text(self):
        visible=self.page.locator('body').inner_text()
        for text in ['DEMONSTRAÇÃO','DADOS FICTÍCIOS','Cenário de teste','B1.2','Supabase','disponibilidade temporariamente desativada','Atualizar períodos','Publicar demonstração']:
            self.assertNotIn(text,visible)
        self.assertEqual(self.page.locator('.demo-label,.demo-description,.demo-banner').count(),0)
    def fill(self):
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('vagas sugeridas')")
    def save(self):
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('salvas nesta aba')")
    def test_clean_shell_primary_departments_and_all_three_editors(self):
        self.clean_text();self.assertEqual(self.page.locator('header nav button').all_text_contents(),['Montar escala','Calendário','Membros','Cadastros','Configurações'])
        self.assertEqual(self.page.locator('.monthly-departments>button').all_text_contents(),['Sonoplastia','Ancionato','Comunicação','Ministério da Família','Ministério da Criança','Música'])
        self.assertEqual(self.page.locator('.monthly-departments details').count(),0)
        self.assertGreater(len(self.catalog()['departments']),6)  # Apenas ocultos na montagem; cadastros preservados.
        for code in ['comunicacao','ancionato','sonoplastia']:self.department(code);self.clean_text()
        self.assertEqual(self.page.locator('a[href*="cenario"],a[href*="corrigida"],a[href="../"]').count(),0)
    def test_automatic_subtle_highlight_and_calendar_link_matches_buttons(self):
        auto=self.page.locator('[data-b1-action=prefill]');self.assertIn('schedule-auto-fill',auto.get_attribute('class'));self.assertNotIn('primary',auto.get_attribute('class'))
        self.assertNotEqual(auto.evaluate('el=>getComputedStyle(el).backgroundColor'),self.page.locator('[data-b1-action=month]').first.evaluate('el=>getComputedStyle(el).backgroundColor'))
        link=self.page.get_by_role('link',name='Ver calendário',exact=True);self.assertIn('schedule-secondary',link.get_attribute('class'));self.assertGreaterEqual(link.bounding_box()['height'],44)
        self.fill();self.save();self.clean_text();self.assertTrue(all(field.input_value() for field in self.page.locator('[data-calendar-volunteer]').all()))
    def test_reload_is_meaningful_and_never_discards_edits_without_confirmation(self):
        self.fill();self.save();field=self.page.locator('[data-calendar-volunteer]').first;first=field.input_value();second=next(v for v in field.locator('option').evaluate_all('els=>els.map(e=>e.value)') if v and v!=first);field.select_option(second)
        self.page.once('dialog',lambda d:d.dismiss());self.page.get_by_role('button',name='Recarregar escala',exact=True).click();self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),second)
        self.page.once('dialog',lambda d:d.accept());self.page.get_by_role('button',name='Recarregar escala',exact=True).click();self.page.wait_for_function('(first)=>document.querySelector("[data-calendar-volunteer]").value===first',arg=first)
    def test_help_supports_hover_focus_escape_touch_and_explains_storage(self):
        button=self.page.get_by_role('button',name='Ajuda sobre o salvamento',exact=True);tip=self.page.locator('#schedule-storage-help');self.assertFalse(tip.is_visible());button.hover();self.assertTrue(tip.is_visible());self.assertIn('Recarregar a página reinicia os dados',tip.inner_text())
        button.focus();self.page.keyboard.press('Escape');self.assertFalse(tip.is_visible());button.click();self.assertTrue(tip.is_visible());button.click();self.assertFalse(tip.is_visible())
        self.department('ancionato');help_button=self.page.locator('.elder-period').first.get_by_role('button',name=re.compile('Detalhes do período'));self.page.keyboard.press('Tab');help_button.focus();self.assertEqual(help_button.get_attribute('aria-expanded'),'true');self.page.keyboard.press('Escape');self.assertEqual(help_button.get_attribute('aria-expanded'),'false')
    def test_weekly_annual_help_and_monthly_conflict_exception_preserved(self):
        self.department('ancionato');self.assertGreater(self.page.locator('.elder-week-row').count(),0);self.page.locator('[data-kind=monthly]').click();self.assertEqual(self.page.locator('.elder-month-card').count(),12);self.clean_text()
        self.page.get_by_role('button',name='Ajuda sobre a escala de anciãos',exact=True).click();self.assertIn('não bloqueia',self.page.locator('#elder-guide').inner_text());self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate("IASDPIElderPeriods.conflictsEnabled({kind:'monthly'})"),False);self.assertEqual(self.page.evaluate("IASDPIElderPeriods.conflictsEnabled({kind:'weekly'})"),True)
        self.assertEqual(self.page.get_by_role('button',name='Recarregar escala',exact=True).count(),1)
    def test_publication_feedback_calendar_navigation_and_history_unchanged(self):
        original=self.page.evaluate('JSON.stringify({legacy:IASDPIKnownPreview.legacy,official:IASDPICalendarOfficialSource()})');self.fill();self.save();self.page.once('dialog',lambda d:d.accept());self.page.get_by_role('button',name='Publicar escala',exact=True).click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Escala publicada')")
        self.page.get_by_role('link',name='Ver calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar');self.clean_text();self.assertEqual(self.page.locator('#scale-month').input_value(),'2026-11');self.assertGreater(self.page.evaluate("IASDPIScheduleCalendar.data().filter(r=>r.id.startsWith('local:')).length"),0)
        self.assertEqual(original,self.page.evaluate('JSON.stringify({legacy:IASDPIKnownPreview.legacy,official:IASDPICalendarOfficialSource()})'))
    def test_errors_stay_visible_and_pending_entries_are_not_lost(self):
        before=self.page.locator('[data-calendar-volunteer]').count();self.page.once('dialog',lambda d:d.accept());self.page.get_by_role('button',name='Publicar escala',exact=True).click();self.page.wait_for_selector('[role=alert]');self.assertIn('vagas',self.page.locator('[role=alert]').first.inner_text());self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),before)
        self.assertIn('vagas',self.page.locator('.schedule-publishbar').inner_text())
    def test_mobile_all_views_and_tooltips_fit_viewport(self):
        for code in ['sonoplastia','comunicacao','ancionato']:
            self.department(code)
            for width in [360,390,768,1024,1440]:
                self.page.set_viewport_size(dict(width=width,height=1000));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                button=self.page.get_by_role('button',name='Ajuda sobre o salvamento',exact=True);button.click();tip=self.page.locator('#schedule-storage-help').bounding_box();self.assertGreaterEqual(tip['x'],0);self.assertLessEqual(tip['x']+tip['width'],width);button.click()
            for width,label in [(1440,'desktop'),(390,'mobile')]:
                self.page.set_viewport_size(dict(width=width,height=1000));self.page.screenshot(path=str(base.ROOT/f'dist/schedule-review-ready/{code}-{label}.png'),full_page=True)
        self.page.locator('[data-kind=monthly]').click()
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size(dict(width=width,height=1000));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        ids=self.page.locator('[id]').evaluate_all('els=>els.map(e=>e.id)');self.assertEqual(len(ids),len(set(ids)))
        self.page.set_viewport_size(dict(width=390,height=1000));self.page.screenshot(path=str(base.ROOT/'dist/schedule-review-ready/ancionato-anual-mobile.png'),full_page=True)
