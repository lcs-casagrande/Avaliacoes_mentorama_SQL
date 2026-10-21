"""Pages no mesmo caminho: registros legados preservados e Supabase sem escrita."""
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

import test_frontend_access as base

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pages_builder', ROOT / 'scripts/build_homologation.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class ExistingPagesTests(base.FrontendAccessTests):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='iasdpi-pages-')
        site = Path(cls.directory.name) / 'Avaliacoes_mentorama_SQL'
        builder.build(site, 'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/', preserve_local=True)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(base.QuietHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.http.server_port) + '/Avaliacoes_mentorama_SQL/'
        cls.pw = base.sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.directory.cleanup()

    def test_release_uses_old_keys_and_versioned_assets(self):
        self.open()
        self.assertEqual(self.page.evaluate('IASDPIStorage.programs'), 'iasdpi-demo-v1')
        self.assertTrue(self.page.evaluate('IASDPIConfig.remoteReadOnly'))
        self.assertIn('VALIDAÇÃO', self.page.locator('#validation-banner').inner_text())
        self.assertTrue(self.page.evaluate("[...document.scripts].every(s=>s.src.includes('?v='))"))
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_release_rejects_cloud_and_admin_writes(self):
        self.role = 'admin'
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.isAdmin() && !state.busy')
        posts = []
        self.page.on('request', lambda request: posts.append(request.url) if request.method != 'GET' else None)
        denied = self.page.evaluate('''async()=>{
          const results=[];
          for(const name of ['iasdpi_set_access','iasdpi_create_invite','iasdpi_revoke_invite','iasdpi_accept_invite']){
            try{await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',body:'{}'});results.push(false);}catch(_){results.push(true);}
          }
          try{await cloudSave();results.push(false);}catch(_){results.push(true);}
          await cloudAutoArchive();
          return results;
        }''')
        self.assertTrue(all(denied))
        self.assertEqual(posts, [])
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_backup_roundtrip_does_not_replace_existing_records(self):
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        result = self.page.evaluate('''async()=>{
          const backup=await backupPayload();
          const encrypted=await encryptBackup(backup,'backup-password-test');
          const decoded=await decryptBackup(encrypted,'backup-password-test');
          const same=await restoreBackup(decoded);
          decoded.programs[0].note='Versão diferente';
          const changed=await restoreBackup(decoded);
          return {same,changed,programs:JSON.parse(localStorage.getItem('iasdpi-demo-v1'))};
        }''')
        self.assertEqual(result['same'], {'added': 0, 'copies': 0})
        self.assertEqual(result['changed'], {'added': 1, 'copies': 1})
        self.assertEqual(result['programs'][0], json.loads(self.raw)[0])
        self.assertEqual(len(result['programs']), 2)
