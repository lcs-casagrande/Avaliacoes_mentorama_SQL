"""Pacote G3, rollback v4 e prévia sem rede, em destinos temporários."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import test_pages_release as release
import test_frontend_access as browser
b=release.builder
class GovernancePackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='iasdpi-g3-package-');self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
    def test_manifest5_requires_governance_and_hash_integrity(self):
        site=self.root/'new';m=b.build(site);self.assertEqual(m['manifest_version'],6);self.assertIn('governance.js',m['files']);b.validate_package(site)
        (site/'governance.js').write_text('modified')
        with self.assertRaisesRegex(ValueError,'SHA-256 inválida'):b.validate_package(site)
    def test_missing_module_is_rejected_even_when_inventory_is_changed(self):
        site=self.root/'new';m=b.build(site);del m['files']['governance.js'];(site/'governance.js').unlink();(site/'manifest.json').write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'obrigatório ausente'):b.validate_package(site)
    def test_previous_v4_remains_valid_and_rollback_preserves_it(self):
        old=self.root/'old';m=b.build(old);m['manifest_version']=4;del m['files']['governance.js'];(old/'governance.js').unlink();(old/'manifest.json').write_text(json.dumps(m));b.validate_package(old)
        new=self.root/'new';b.build(new,previous_site=old);rollback=self.root/'rollback';r=b.build_rollback(rollback,old,new);self.assertEqual(r['manifest_version'],4);b.validate_package(rollback)
    def test_preview_fixture_never_enters_production_and_flags_remain_off(self):
        site=self.root/'new';m=b.build(site);bundle=(site/m['entry']['bundle'].split('?')[0]).read_text();self.assertIn('window.IASDPIGovernance=',bundle);self.assertNotIn('Líder de exemplo',bundle);self.assertNotIn('server-test-only',bundle)
        cfg=(site/'config.js').read_text();self.assertIn('"governanceEnabled": false',cfg)
@unittest.skipUnless(browser.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class GovernanceStandalonePreviewTests(unittest.TestCase):
    def test_local_preview_navigation_mutation_and_no_external_requests(self):
        with tempfile.TemporaryDirectory(prefix='iasdpi-g3-preview-') as temp:
            output=Path(temp)/'preview.html';subprocess.run(['python','scripts/export_preview.py','--governance-preview','--output',str(output)],cwd=b.ROOT,check=True,capture_output=True)
            with browser.sync_playwright() as p:
                chrome=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=chrome.new_page();errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));server=ThreadingHTTPServer(('127.0.0.1',0),partial(browser.QuietHandler,directory=temp));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();self.addCleanup(server.server_close);self.addCleanup(server.shutdown);page.goto('http://127.0.0.1:'+str(server.server_port)+'/preview.html');page.wait_for_selector('[data-gov-tab=permissions]');self.assertIn('DADOS FICTÍCIOS',page.locator('.demo-banner').filter(has_text='DADOS FICTÍCIOS').inner_text());page.locator('[data-gov-tab=permissions]').click();form=page.locator('[data-gov-form=permissions][data-version="1"]');form.locator('[name=publish]').check();form.locator('button').click();page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Alteração confirmada')");page.locator('nav [data-page=access-request]').click();page.wait_for_selector('[data-gov-form=request]');self.assertFalse(any(u.startswith('https://') for u in requests));self.assertEqual(errors,[]);chrome.close()
