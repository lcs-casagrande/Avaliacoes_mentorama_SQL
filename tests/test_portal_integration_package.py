import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import test_pages_release as release
b=release.builder
class PortalIntegrationPackageTests(unittest.TestCase):
    def test_version6_requires_both_modules_and_integrity(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'site';m=b.build(out);self.assertEqual(m['manifest_version'],6);b.validate_package(out)
            for name in ['church-portal.js','portal-access.js']:self.assertIn(name,m['files'])
            (out/'portal-access.js').write_text('tampered')
            with self.assertRaisesRegex(ValueError,'SHA-256 inválida'):b.validate_package(out)
    def test_rollback_to_original_version5_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);old=root/'old';m=b.build(old);m['manifest_version']=5
            for name in ['church-portal.js','portal-access.js']:del m['files'][name];(old/name).unlink()
            (old/'manifest.json').write_text(json.dumps(m));b.validate_package(old);new=root/'new';b.build(new,previous_site=old);out=root/'rollback';self.assertEqual(b.build_rollback(out,old,new)['manifest_version'],5);b.validate_package(out)
    def test_production_bundle_keeps_flags_off_and_excludes_fictitious_accounts(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'site';m=b.build(out);bundle=(out/m['entry']['bundle'].split('?')[0]).read_text();self.assertNotIn('Demonstracao#2026',bundle);self.assertNotIn('g4demo.supabase.co',bundle);self.assertIn('"portalAccessEnabled": false',(out/'config.js').read_text());self.assertIn('IASDPIPortalAccess',bundle)
