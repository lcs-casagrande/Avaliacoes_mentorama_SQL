"""Preparação do projeto existente: pacote fechado e navegador sem rede externa."""
import hashlib
import json
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest

import test_frontend_access as browser_base

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_homologation as build

SITE = 'https://preparacao.iasdpi.invalid/portal/'


class ExistingPreparationPackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / 'site'

    def package(self):
        return build.build(self.out, SITE, prepare_existing=True)

    def config(self):
        return json.loads((self.out / 'config.js').read_text().split('Object.freeze(', 1)[1].rsplit(');', 1)[0])

    def test_existing_project_profile_is_always_closed_with_isolated_sessions(self):
        manifest = self.package()
        cfg = self.config()
        self.assertTrue(cfg['remoteDisabled'])
        self.assertTrue(cfg['remoteReadOnly'])
        self.assertTrue(cfg['connectionPreparation'])
        self.assertTrue(cfg['responsibilityGovernanceEnabled'])
        self.assertTrue(cfg['calendarPrivacyEnabled'])
        self.assertEqual(cfg['storageMode'], 'supabase')
        self.assertEqual(cfg['storageNamespace'], 'iasdpi-existing-preparation-v1')
        self.assertTrue(manifest['connection_preparation'])
        self.assertIn("connect-src 'none'", (self.out / 'index.html').read_text())
        build.validate_package(self.out)

    def test_source_configuration_visual_and_historical_files_are_not_changed(self):
        names = ['config.js', 'styles.css', 'index.html', 'agenda-data.js', 'organization.js']
        before = {name: (ROOT / 'frontend' / name).read_bytes() for name in names}
        self.package()
        self.assertEqual(before, {name: (ROOT / 'frontend' / name).read_bytes() for name in names})
        self.assertEqual((self.out / 'styles.css').read_bytes(), before['styles.css'])
        self.assertFalse(any(path.suffix in ('.mjs', '.ts', '.sql') for path in self.out.rglob('*')))

    def test_preparation_cannot_combine_with_connected_or_retained_modes(self):
        for flags in ({'real_homologation': True}, {'operational': True}, {'preserve_local': True},
                      {'previous_site': self.out.parent / 'old'}):
            with self.assertRaises(ValueError):
                build.build(self.out, SITE, prepare_existing=True, **flags)
        self.assertFalse(self.out.exists())

    def test_public_config_cannot_override_network_locks_or_include_secrets(self):
        cfg = {'supabaseUrl': 'https://pwbxksxxmnblqwpvlheu.supabase.co',
               'supabasePublishableKey': 'sb_publishable_synthetic_public_only_1234567890'}
        for patch in ({'remoteDisabled': False}, {'remoteReadOnly': False}, {'service_role': 'invalid'}):
            with self.assertRaises(ValueError):
                build.build(self.out, SITE, prepare_existing=True, public_config={**cfg, **patch})

    def test_connected_hml_still_rejects_existing_production_project(self):
        cfg = {'supabaseUrl': 'https://pwbxksxxmnblqwpvlheu.supabase.co',
               'supabasePublishableKey': 'sb_publishable_synthetic_public_only_1234567890'}
        with self.assertRaisesRegex(ValueError, 'produção'):
            build.build(self.out, SITE, real_homologation=True, public_config=cfg)

    def tamper(self, name, before, after):
        path = self.out / name
        path.write_text(path.read_text().replace(before, after))
        manifest_path = self.out / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['files'][name] = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))

    def test_config_unlock_is_rejected_even_with_updated_file_digest(self):
        self.package()
        self.tamper('config.js', '"remoteDisabled": true', '"remoteDisabled": false')
        with self.assertRaisesRegex(ValueError, 'rede desativada'):
            build.validate_package(self.out)

    def test_csp_unlock_is_rejected_even_with_updated_file_digest(self):
        self.package()
        self.tamper('index.html', "connect-src 'none'", "connect-src 'self' https://pwbxksxxmnblqwpvlheu.supabase.co")
        with self.assertRaisesRegex(ValueError, 'rede desativada'):
            build.validate_package(self.out)


@unittest.skipUnless(browser_base.sync_playwright and shutil.which('chromium'), 'Requer Chromium/Playwright')
class ExistingPreparationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.site = Path(cls.tmp.name) / 'site'
        build.build(cls.site, SITE, prepare_existing=True)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(browser_base.QuietHandler, directory=cls.site))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}/'
        cls.pw = browser_base.sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        cls.tmp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context()
        self.external = []
        self.errors = []
        def route(request):
            if request.request.url.startswith(self.url):
                request.continue_()
            else:
                self.external.append(request.request.url)
                request.abort()
        self.context.route('**/*', route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.wait_for_function("()=>!!window.IASDPIAuth && document.getElementById('release-recovery')?.hidden")

    def tearDown(self):
        try:
            self.assertEqual(self.external, [])
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def test_all_remote_paths_are_denied_before_fetch_including_auth_and_password(self):
        result = self.page.evaluate('''async()=>{
          const paths=['/auth/v1/user','/auth/v1/token?grant_type=password','/auth/v1/token?grant_type=refresh_token',
            '/auth/v1/recover','/auth/v1/signup','/functions/v1/alias-login','/functions/v1/access-assistance',
            '/rest/v1/rpc/iasdpi_registry_save','/rest/v1/rpc/iasdpi_event_submit','/rest/v1/rpc/iasdpi_schedule_plan_save',
            '/rest/v1/rpc/iasdpi_password_change_context'];
          const denied=paths.every(path=>['GET','POST','PATCH','DELETE'].every(method=>!IASDPIAuth.remoteRequestAllowed(path,method)));
          let blocked=false;try{await IASDPIAuth.jsonRequest(paths[0]);}catch(e){blocked=e.message.includes('desativado');}
          return {denied,blocked};
        }''')
        self.assertEqual(result, {'denied': True, 'blocked': True})

    def test_sdk_login_and_recovery_cannot_bypass_disabled_network(self):
        result = self.page.evaluate('''async()=>{
          window.IASDPIConfig=Object.freeze({...IASDPIConfig,churchIsolationEnabled:false,remoteReadOnly:false});
          const failures=[];
          for(const action of [()=>IASDPIAuth.loginIdentity('synthetic@example.invalid','SyntheticOnly#2026'),
                               ()=>IASDPIAuth.requestPasswordReset('synthetic@example.invalid')]){
            try{await action();failures.push(false);}catch{failures.push(true);}
          }
          return failures;
        }''')
        self.assertEqual(result, [True, True])

    def test_browser_csp_also_blocks_direct_fetch(self):
        self.assertTrue(self.page.evaluate("async()=>{try{await fetch(IASDPIConfig.supabaseUrl+'/rest/v1/iasdpi_access');return false;}catch{return true;}}"))

    def test_public_navigation_and_mobile_remain_without_external_connections(self):
        output = ROOT / 'dist/supabase-existing-preparation'
        output.mkdir(parents=True, exist_ok=True)
        for width in (1440, 390):
            self.page.set_viewport_size({'width': width, 'height': 900})
            for route in ('church-home', 'schedule-calendar', 'organization', 'portal-login'):
                self.page.goto(self.url + '#' + route)
                self.page.wait_for_function("()=>document.getElementById('release-recovery')?.hidden")
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            self.page.screenshot(path=str(output / f'preparation-{width}.png'), full_page=True)
