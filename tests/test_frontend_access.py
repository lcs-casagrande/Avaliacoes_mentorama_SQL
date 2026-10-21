"""Navegador isolado, registros fictícios e Supabase simulado. Sem rede externa."""
import copy
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import threading
import unittest

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

ROOT = Path(__file__).resolve().parents[1]
USER = '11111111-1111-4111-8111-111111111111'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@unittest.skipUnless(sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class FrontendAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'frontend')))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.http.server_port) + '/?demo=1'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def setUp(self):
        self.role = 'leader'
        self.expiry = 3600
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        plan = json.loads((ROOT / 'backend' / 'chronogram.json').read_text())
        plan['name'] = 'REGISTRO PRIVADO TESTE'
        for item in plan['items']:
            item['planned_start'] = plan['date'] + 'T' + item['start'] + ':00-03:00'
            item['planned_end'] = plan['date'] + 'T' + item['end'] + ':00-03:00'
        program = {'id': 'test-program', 'version': 1, 'plan': plan, 'status': 'Planejamento',
                   'execution_mode': 'manual', 'executions': {}, 'actual_details': {},
                   'extra_events': [], 'note': '', 'incident': '', 'paused': False,
                   'planned_start': plan['date'] + 'T09:30:00-03:00',
                   'planned_end': plan['date'] + 'T11:24:00-03:00'}
        self.raw = json.dumps([program], ensure_ascii=False)
        self.page.add_init_script('''
          if(!localStorage.getItem('fixture-ready')){
            localStorage.setItem('fixture-ready','yes');
            localStorage.setItem('iasdpi-demo-v1', %s);
            localStorage.setItem('iasdpi-cloud-config',JSON.stringify({key:'sb_publishable_test'}));
          }
        ''' % json.dumps(self.raw))
        self.page.route('https://*.supabase.co/**', self.supabase)

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def supabase(self, route):
        url = route.request.url
        if '/auth/v1/token' in url:
            if json.loads(route.request.post_data)['password'] == 'wrong':
                route.fulfill(status=400, json={'error': 'invalid_credentials'})
            else:
                route.fulfill(json={'access_token': 'valid.test.token', 'expires_in': self.expiry,
                                    'user': {'id': USER, 'email': 'test@example.invalid'}})
        elif '/auth/v1/user' in url:
            route.fulfill(json={'id': USER, 'email': 'test@example.invalid', 'is_anonymous': False,
                                'user_metadata': {'role': 'admin'}})
        elif '/iasdpi_access?' in url:
            route.fulfill(json=[{'user_id': USER, 'role': self.role, 'enabled': True}] if self.role else [])
        elif '/auth/v1/logout' in url:
            route.fulfill(status=204)
        elif '/iasdpi_templates?' in url:
            route.fulfill(json=[{'plan': json.loads((ROOT / 'backend' / 'chronogram.json').read_text())}])
        elif '/culto_archives' in url:
            route.fulfill(json=[])
        else:
            route.fulfill(status=404, json={})

    def open(self, fragment=''):
        self.page.goto(self.base + fragment)
        self.page.wait_for_function("() => document.querySelector('#app h1')!==null")

    def login(self):
        self.page.locator('nav [data-page="login"]').click()
        self.page.locator('#auth-login-form [name="email"]').fill('test@example.invalid')
        self.page.locator('#auth-login-form [name="password"]').fill('correct-password')
        self.page.locator('#auth-login-form button').click()

    def test_public_pages_and_direct_access_preserve_storage(self):
        self.open()
        self.assertEqual(self.page.locator('.organization-elder').count(), 9)
        self.assertFalse(self.page.locator('nav [data-page="history"]').is_visible())
        self.assertNotIn('REGISTRO PRIVADO TESTE', self.page.locator('#app').inner_text())
        for expression in ["IASDPIDemo.request('programs','GET')", 'backupPayload()', "restoreBackup({})"]:
            denied = self.page.evaluate('async()=>{try{await ' + expression + ';return false;}catch(_){return true;}}')
            self.assertTrue(denied)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)
        self.open('#history')
        self.page.wait_for_selector('#auth-login-form')
        self.assertNotIn('REGISTRO PRIVADO TESTE', self.page.locator('#app').inner_text())
        self.page.locator('nav [data-page="agendas"]').click()
        self.page.wait_for_selector('.agenda-toolbar')

    def test_leader_can_edit_and_logout_keeps_original_records(self):
        self.open()
        self.login()
        self.page.wait_for_function("() => IASDPIAuth.allowed() && state.programs.length===1")
        self.assertTrue(self.page.locator('nav [data-page="history"]').is_visible())
        self.page.locator('nav [data-page="actuals"]').click()
        self.page.wait_for_selector('#actuals-form')
        self.page.locator('.actual-row [name="start"]').first.fill('09:32:18')
        self.page.locator('.actual-row [name="end"]').first.fill('09:37:16')
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_function("() => JSON.parse(localStorage.getItem('iasdpi-demo-v1'))[0].version===2")
        saved = self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')")
        self.page.locator('#auth-logout').click()
        self.page.wait_for_selector('.organization-elder')
        self.assertEqual(self.page.evaluate('state.programs.length'), 0)
        self.assertIsNone(self.page.evaluate('window.IASDPIChronogram'))
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), saved)
        self.assertNotIn('REGISTRO PRIVADO TESTE', self.page.locator('#app').inner_text())

    def test_auth_metadata_does_not_grant_access(self):
        self.role = ''
        self.open()
        self.login()
        self.page.wait_for_function("() => !state.busy")
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.page.evaluate('state.programs.length'), 0)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_revocation_blocks_next_operation_and_hides_loaded_data(self):
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.role = ''
        self.page.evaluate('async()=>{try{await IASDPIAuth.requireAccess();}catch(_){}}')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.page.evaluate('state.programs.length'), 0)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_session_expiry_hides_private_content(self):
        self.expiry = 1
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.page.wait_for_function('() => !IASDPIAuth.allowed() && state.programs.length===0', timeout=5000)
        self.assertFalse(self.page.locator('nav [data-page="history"]').is_visible())

    def test_admin_and_mobile_navigation(self):
        self.role = 'admin'
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertNotIn('correct-password', self.page.evaluate('JSON.stringify(localStorage)'))
        self.assertNotIn('valid.test.token', self.page.evaluate('JSON.stringify(localStorage)'))

    def test_new_manual_record_loads_protected_template(self):
        self.open()
        self.assertIsNone(self.page.evaluate('window.IASDPIChronogram'))
        self.page.evaluate("localStorage.setItem('iasdpi-demo-v1','[]')")
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed()')
        self.page.locator('nav [data-page="actuals"]').click()
        self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').count(), 16)
        self.page.locator('.actual-row [name="start"]').first.fill('09:32:18')
        self.page.locator('.actual-row [name="end"]').first.fill('09:37:16')
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_function("() => JSON.parse(localStorage.getItem('iasdpi-demo-v1'))[0]?.version===2")
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('iasdpi-demo-v1')).length"), 1)

    def test_wrong_password_cannot_load_saved_records(self):
        self.open('#history')
        self.page.locator('#auth-login-form [name="email"]').fill('test@example.invalid')
        self.page.locator('#auth-login-form [name="password"]').fill('wrong')
        self.page.locator('#auth-login-form button').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.page.evaluate('state.programs.length'), 0)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_authorized_backup_roundtrip_preserves_data(self):
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.page.locator('nav [data-page="archive"]').click()
        self.page.wait_for_selector('#backup-export-form')
        result = self.page.evaluate('''async()=>{
          const original=await backupPayload();
          const encrypted=await encryptBackup(original,'senha-teste-segura');
          const restored=await decryptBackup(encrypted,'senha-teste-segura');
          let denied=false;try{await decryptBackup(encrypted,'senha-errada');}catch(_){denied=true;}
          return {equal:JSON.stringify(original)===JSON.stringify(restored),denied};
        }''')
        self.assertEqual(result, {'equal': True, 'denied': True})
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)


if __name__ == '__main__':
    unittest.main()
