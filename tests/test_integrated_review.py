"""Pacote de homologação: publicação estática isolada, navegação e preservação."""
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import test_frontend_access as base

sys.path.insert(0, str(base.ROOT / 'scripts'))
import build_schedule_demo
import prepare_integrated_review as review


class SiteFixture:
    @classmethod
    def make_site(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='iasdpi-review-test-')
        cls.root = Path(cls.tmp.name)
        cls.old = cls.root / 'old'
        build_schedule_demo.build(cls.old, calendar_preview=True)
        (cls.old / 'b12').mkdir()
        (cls.old / 'b12/index.html').write_text('<!doctype html><html lang="pt-BR"><title>Demonstração anterior</title><body>Anterior</body></html>')
        subprocess.run(['git', 'init', '-q', str(cls.old)], check=True, capture_output=True)
        subprocess.run(['git', 'add', '.'], cwd=cls.old, check=True, capture_output=True)
        cls.before = {str(p.relative_to(cls.old)): review.sha(p) for p in cls.old.rglob('*') if p.is_file() and '.git' not in p.parts}
        cls.site = cls.root / 'site'
        review.prepare(cls.site, cls.old)


class IntegratedReviewPackageTests(SiteFixture, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.make_site()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def editable_copy(self):
        temp = tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        path = Path(temp.name) / 'integrada'
        shutil.copytree(self.site / 'integrada', path)
        return path

    def rehash(self, path):
        m = json.loads((path / 'manifest.json').read_text())
        m['files']['index.html'] = review.sha(path / 'index.html')
        (path / 'manifest.json').write_text(json.dumps(m))

    def test_manifest_previous_links_and_exact_historical_preservation(self):
        m = review.validate(self.site / 'integrada')
        self.assertFalse(m['database_connected']);self.assertEqual(m['excluded'], ['E1'])
        for name, digest in self.before.items():
            self.assertEqual(review.sha(self.old / name), digest)
            if name not in ['index.html', 'manifest.json']:
                self.assertEqual(review.sha(self.site / name), digest)
        self.assertIn('href="integrada/"', (self.site / 'index.html').read_text())
        self.assertIn('href="../"', (self.site / 'integrada/index.html').read_text())
        self.assertFalse(list(self.site.rglob('*.zip')))

    def test_tampering_missing_files_and_external_dependencies_are_rejected(self):
        path = self.editable_copy();(path / 'LEIA-ME.md').unlink()
        with self.assertRaises(ValueError):review.validate(path)
        path = self.editable_copy();(path / 'index.html').write_text((path / 'index.html').read_text() + '<script src="https://example.invalid/external.js"></script>')
        with self.assertRaisesRegex(ValueError, 'Integridade'):review.validate(path)
        self.rehash(path)
        with self.assertRaisesRegex(ValueError, 'independente'):review.validate(path)

    def test_real_supabase_or_privileged_credentials_are_rejected_even_after_rehash(self):
        for value in ['pwbxksxxmnblqwpvlheu', 'chzltoqifqgylgkxbwuk', 'sb_secret_fictitious_rejection_test_only']:
            path = self.editable_copy();(path / 'index.html').write_text((path / 'index.html').read_text() + '<!-- ' + value + ' -->');self.rehash(path)
            with self.assertRaisesRegex(ValueError, 'Credencial'):review.validate(path)

    def test_existing_destination_and_real_config_are_preserved(self):
        before = (base.ROOT / 'frontend/config.js').read_bytes()
        with self.assertRaisesRegex(ValueError, 'Destino'):review.prepare(self.site, self.old)
        self.assertEqual((base.ROOT / 'frontend/config.js').read_bytes(), before)


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Chromium/Playwright')
class IntegratedReviewBrowserTests(SiteFixture, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.make_site()
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(base.QuietHandler, directory=str(cls.site)))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True);cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}/'
        cls.pw = base.sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context()
        self.page = self.context.new_page();self.errors = [];self.requests = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('request', lambda r: self.requests.append(r.url))
        self.page.goto(self.url + 'integrada/');self.page.wait_for_selector('.church-portal-cards')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
            self.assertTrue(all(r.startswith(self.url) for r in self.requests), self.requests)
        finally:self.context.close()

    def go(self, route):
        self.page.wait_for_function('()=>!bootInProgress&&!state.busy')
        self.page.get_by_role('navigation', name='Navegação principal', exact=True).locator('[data-page="' + route + '"]').click()

    def login(self, alias='admin.teste'):
        self.go('schedule-build');self.page.wait_for_selector('#church-select')
        self.page.select_option('#church-select', 'IASD_PI')
        self.page.get_by_role('button', name='Continuar', exact=True).click()
        self.page.wait_for_selector('#portal-login-form')
        self.page.fill('#portal-login-form [name=email]', alias)
        self.page.fill('#portal-login-form [name=password]', 'Demonstracao#2026')
        self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar')

    def test_public_navigation_history_links_and_no_real_connection(self):
        self.assertTrue(self.page.locator('.review-banner').is_visible())
        for route, selector in [('agendas', '.agenda-calendar'), ('organization', '#organization-results'), ('schedule-calendar', '.scale-calendar')]:
            self.go(route);self.page.wait_for_selector(selector)
        self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'), 20)
        self.assertEqual(self.page.evaluate('IASDPIConfig.storageNamespace'), review.NAMESPACE)
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertTrue(self.page.evaluate("fetch('https://example.invalid/must-not-send').then(()=>false,()=>true)"))
        for path in ['', 'b12/', 'integrada/LEIA-ME.md', 'integrada/manifest.json']:
            self.assertEqual(self.page.request.get(self.url + path).status, 200)

    def test_administrator_registry_and_governance_are_navigable(self):
        self.login();self.go('schedule-members');self.page.wait_for_selector('#registry-people-results')
        self.assertIn('Lucas Borrego', self.page.locator('#app').inner_text())
        self.go('access-admin');self.page.wait_for_selector('.governance-tabs')
        self.assertGreater(self.page.locator('[data-gov-tab=aliases]').count(), 0)

    def test_multiple_departments_keep_one_identity_without_admin_privileges(self):
        self.login('multi.teste')
        names = self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents()
        self.assertEqual(set(names), {'Sonoplastia', 'Música'})
        uid = self.page.evaluate('async()=> (await IASDPIAuth.requireIdentity()).user.id')
        self.page.locator('.monthly-departments [data-b1-action=department]').filter(has_text='Música').click()
        self.page.wait_for_selector('.monthly-calendar')
        self.assertEqual(uid, self.page.evaluate('async()=> (await IASDPIAuth.requireIdentity()).user.id'))
        self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'))

    def test_viewer_cannot_save_or_publish(self):
        self.login('leitura.teste')
        for action in ['save', 'publish', 'prefill']:
            self.assertEqual(self.page.locator('[data-b1-action=' + action + ']').count(), 0)

    def test_confirmed_rotation_publication_and_reload_reset(self):
        self.login('som.teste')
        self.page.locator('[data-b1-action=prefill]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('sugeridas')")
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').evaluate_all('es=>es.filter(e=>e.value).length'), 0)
        self.go('schedule-members');self.page.wait_for_selector('#registry-department')
        p = self.page.evaluate("async()=>{const c=await IASDPISchedules.request('iasdpi_registry_catalog'),p=c.people.find(p=>p.name==='Luan Vaz');return c.memberships.find(m=>m.person_id===p.id&&m.department_id==='00000000-0000-4000-8000-000000000001');}")
        row = self.page.locator('[data-registry-member="' + p['id'] + '"]')
        row.locator('[name=participation_confirmed]').check();row.locator('[name=role_ids]').first.check()
        for day in range(7):row.locator('[name=day_' + str(day) + ']').select_option('available')
        self.page.once('dialog', lambda d: d.accept());row.locator('button[type=submit]').click()
        self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        self.go('schedule-build');self.page.wait_for_selector('[data-b1-action=prefill]')
        self.page.locator('[data-b1-action=prefill]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('sugeridas')")
        self.assertTrue(all(f.input_value() for f in self.page.locator('[data-calendar-volunteer]').all()))
        month = self.page.locator('#schedule-month').input_value()
        self.page.locator('[data-b1-action=save]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        self.page.once('dialog', lambda d: d.accept());self.page.locator('[data-b1-action=publish]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('publicada')")
        self.page.locator('#auth-logout').click();self.page.wait_for_function('()=>!IASDPIPortalAccess.valid()&&!state.busy')
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        picker = self.page.locator('[data-month-picker="scale-month"]')
        picker.locator('[data-month-open]').click()
        year = int(picker.locator('[data-picker-year-label]').inner_text())
        while year != int(month[:4]):
            delta = 1 if year < int(month[:4]) else -1
            picker.locator('[data-month-year="' + str(delta) + '"]').click();year += delta
        picker.locator('[data-month-option="' + month[5:7] + '"]').click()
        self.page.wait_for_function("()=>document.querySelector('.portal-feed-state')?.textContent.includes('atribuições publicadas')")
        self.assertIn('Luan Vaz', self.page.locator('.scale-calendar').inner_text())
        self.page.reload();self.page.wait_for_selector('.scale-calendar')
        self.assertTrue(self.page.evaluate("()=>[...IASDPIKnownPreview.plans.values()].every(p=>p.status==='draft')"))

    def test_five_viewports_keyboard_and_visual_evidence(self):
        self.login();out = base.ROOT / 'dist/review-publication';out.mkdir(parents=True, exist_ok=True)
        for route, selector in [('church-home', '.church-portal-cards'), ('organization', '#organization-results'), ('agendas', '.agenda-calendar'), ('schedule-build', '.monthly-calendar'), ('schedule-members', '#registry-people-results')]:
            self.go(route);self.page.wait_for_selector(selector)
            for width in [360, 390, 768, 1024, 1440]:
                self.page.set_viewport_size({'width': width, 'height': 900})
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width, route)
        summary = self.page.locator('.review-banner summary');summary.focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('.review-banner details').evaluate('e=>e.open'))
        for width, label in [(390, 'mobile'), (1440, 'desktop')]:
            self.page.set_viewport_size({'width': width, 'height': 900});self.page.screenshot(path=str(out / ('integrated-' + label + '.png')), full_page=True)
