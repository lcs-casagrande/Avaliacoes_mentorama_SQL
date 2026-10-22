"""Pacote estático e isolamento de armazenamento, sem rede Supabase real."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import subprocess
import sys
import threading
import unittest
from unittest.mock import patch

import test_frontend_access as base

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_homologation', ROOT / 'scripts/build_homologation.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PackageTests(unittest.TestCase):
    def test_default_pages_generator_never_reverts_to_local_storage(self):
        with tempfile.TemporaryDirectory(prefix='iasdpi-default-pages-') as directory:
            output=Path(directory)/'site'
            subprocess.run([sys.executable,str(ROOT/'scripts/build_pages.py'),'--output',str(output)],capture_output=True,text=True,check=True)
            config=(output/'config.js').read_text()
            self.assertIn('"storageMode": "supabase"',config)
            self.assertIn('"remoteReadOnly": false',config)
            manifest=json.loads((output/'manifest.json').read_text())
            self.assertEqual(manifest['environment'],'production')

    def test_static_allowlist_and_readonly_configuration(self):
        with tempfile.TemporaryDirectory(prefix='iasdpi-package-') as directory:
            manifest = builder.build(Path(directory) / 'site')
            names = {p.name for p in (Path(directory) / 'site').iterdir()}
            self.assertEqual(names, set(builder.ASSETS) | {'manifest.json'})
            self.assertNotIn('server.py', names)
            self.assertNotIn('chronogram.json', names)
            config = (Path(directory) / 'site/config.js').read_text()
            self.assertIn('"remoteReadOnly": true', config)
            self.assertIn('"storageMode": "browser"', config)
            self.assertEqual(manifest['storage_namespace'], 'iasdpi-homologacao-v1')

    def test_nonempty_destination_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            existing = Path(directory) / 'existing.txt'
            existing.write_text('preservar')
            with self.assertRaises(ValueError):
                builder.build(directory)
            self.assertEqual(existing.read_text(), 'preservar')

    def test_secret_configuration_is_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'frontend').mkdir()
            (root / 'frontend/config.js').write_text('window.IASDPIConfig = Object.freeze(' + json.dumps({
                'supabaseUrl': 'https://example.supabase.co', 'supabasePublishableKey': 'sb_secret_not_allowed_here'}) + ');')
            with patch.object(builder, 'ROOT', root), self.assertRaises(ValueError):
                builder.build(root / 'output')
            self.assertFalse((root / 'output').exists())


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class HomologationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='iasdpi-staging-')
        builder.build(Path(cls.directory.name) / 'homologacao')
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(base.QuietHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.pw = base.sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def setUp(self):
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('request', lambda r: self.requests.append((r.method, r.url)))
        self.page.route('https://*.supabase.co/**', self.supabase)
        self.original = {name: 'DADO PRINCIPAL INALTERADO: ' + name for name in
                         ['iasdpi-demo-v1', 'iasdpi-cloud-config', 'iasdpi-last-safety-copy-v1', 'iasdpi-before-restore-v1', 'iasdpi-cloud-pending']}
        self.page.add_init_script('''
          const originals=%s;
          for(const [k,v] of Object.entries(originals))localStorage.setItem(k,v);
          window.originalRead=Storage.prototype.getItem;
          window.mainReads=[];window.mainWrites=[];
          const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
          Storage.prototype.getItem=function(k){if(k in originals)mainReads.push(k);return get.call(this,k);};
          Storage.prototype.setItem=function(k,v){if(k in originals)mainWrites.push(k);return set.call(this,k,v);};
          Storage.prototype.removeItem=function(k){if(k in originals)mainWrites.push(k);return remove.call(this,k);};
        ''' % json.dumps(self.original))
        self.page.goto('http://127.0.0.1:' + str(self.http.server_port) + '/homologacao/')
        self.page.wait_for_selector('.organization-elder')

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.page.evaluate('mainReads'), [])
        self.assertEqual(self.page.evaluate('mainWrites'), [])
        for name, value in self.original.items():
            self.assertEqual(self.page.evaluate('(k)=>originalRead.call(localStorage,k)', name), value)
        self.assertFalse(any('/api/' in url for _, url in self.requests))
        self.context.close()

    def supabase(self, route):
        url = route.request.url
        if '/auth/v1/token' in url:
            route.fulfill(json={'access_token': 'valid.test.token', 'refresh_token': 'refresh-test-not-real', 'token_type': 'bearer', 'expires_in': 3600, 'user': {'id': base.USER}})
        elif '/auth/v1/user' in url:
            route.fulfill(json={'id': base.USER, 'email': 'test@example.invalid', 'is_anonymous': False})
        elif '/iasdpi_access?' in url:
            route.fulfill(json=[{'user_id': base.USER, 'role': 'admin', 'enabled': True}])
        elif '/rpc/iasdpi_list_users' in url:
            route.fulfill(json=[{'user_id': base.USER, 'email': 'test@example.invalid', 'role': 'admin', 'enabled': True}])
        elif '/rpc/iasdpi_list_invites' in url:
            route.fulfill(json=[])
        elif '/auth/v1/logout' in url:
            route.fulfill(status=204)
        else:
            route.fulfill(status=500, json={'error': 'Requisição não esperada no teste de consulta'})

    def login(self):
        self.page.locator('nav [data-page="login"]').click()
        self.page.locator('#auth-login-form [name="email"]').fill('test@example.invalid')
        self.page.locator('#auth-login-form [name="password"]').fill('test-password')
        self.page.locator('#auth-login-form button').click()
        self.page.wait_for_function('() => IASDPIAuth.isAdmin() && !state.busy')

    def test_public_pages_static_mode_and_login(self):
        self.assertIn('HOMOLOGAÇÃO', self.page.locator('#homologation-banner').inner_text())
        self.login()
        self.assertEqual(self.page.evaluate('state.programs.length'), 0)
        self.page.locator('nav [data-page="users"]').click()
        self.page.wait_for_selector('.user-access-form')
        self.assertIn('consulta', self.page.locator('.form-note').inner_text())

    def test_all_remote_mutations_are_blocked(self):
        self.login()
        denied = self.page.evaluate('''async()=>{
          const paths=['iasdpi_set_access','iasdpi_create_invite','iasdpi_revoke_invite','iasdpi_accept_invite'];
          const results=[];
          for(const name of paths){try{await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',body:'{}'});results.push(false);}catch(_){results.push(true);}}
          try{await cloudRequest('/rest/v1/culto_archives',{method:'POST',body:'{}'});results.push(false);}catch(_){results.push(true);}
          try{await IASDPIAuth.signup('new@example.invalid','test-password');results.push(false);}catch(_){results.push(true);}
          return results;
        }''')
        self.assertTrue(all(denied))
        posts = [url for method, url in self.requests if method == 'POST']
        self.assertTrue(all('/auth/v1/token?' in url for url in posts))

    def test_local_changes_and_backups_use_separate_keys(self):
        self.login()
        result = self.page.evaluate('''async()=>{
          const plan={name:'Teste isolado',date:'2026-10-21',start:'09:30',end:'09:40',team:{},items:[{id:'one',block:'Culto',activity:'Teste',start:'09:30',end:'09:40',note:'',responsible:''}]};
          let p=await api('programs','POST',plan);
          p=await api('programs/'+p.id+'/notes','PUT',{version:p.version,note:'Teste',incident:''});
          const backup=await backupPayload();
          await restoreBackup(backup);
          return {count:backup.programs.length,safety:localStorage.getItem(IASDPIStorage.safety)!==null,before:localStorage.getItem(IASDPIStorage.beforeRestore)!==null};
        }''')
        self.assertEqual(result, {'count': 1, 'safety': True, 'before': True})
        self.assertFalse(any('/culto_archives' in url for _, url in self.requests))

    def test_logout_only_revokes_the_staging_session(self):
        self.login()
        self.page.locator('#auth-logout').click()
        self.page.wait_for_function('() => !IASDPIAuth.allowed()')
        self.page.wait_for_function('() => !state.busy')
        self.page.wait_for_timeout(50)
        urls = [url for method, url in self.requests if method == 'POST' and '/auth/v1/logout' in url]
        self.assertEqual(len(urls), 1)
        self.assertTrue(urls[0].endswith('/auth/v1/logout?scope=local'))
