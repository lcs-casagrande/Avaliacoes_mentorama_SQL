"""Formato novo sem quebrar pacotes anteriores ou enfraquecer a integridade."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import test_pages_release as release

b=release.builder

class ScheduleFoundationPackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='iasdpi-phase-a-package-');self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def test_module_is_required_in_v2_and_hash_checked(self):
        site=self.root/'candidate';m=b.build(site)
        self.assertEqual(m['manifest_version'],6);self.assertIn('schedule-foundation.js',m['files'])
        self.assertEqual(b.validate_package(site),m)
        (site/'schedule-foundation.js').write_text('adulterado')
        with self.assertRaisesRegex(ValueError,'Integridade'):b.validate_package(site)
    def test_missing_module_rejected_even_if_removed_from_manifest(self):
        site=self.root/'candidate';m=b.build(site);(site/'schedule-foundation.js').unlink();del m['files']['schedule-foundation.js']
        (site/'manifest.json').write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'obrigatório ausente'):b.validate_package(site)
    def test_v1_package_supported_and_rollback_keeps_version(self):
        # Formato 1 exige exatamente o inventário anterior: novo módulo ainda não existia.
        old=self.root/'v1';m=b.build(old);m['manifest_version']=1
        del m['files']['schedule-foundation.js'];(old/'schedule-foundation.js').unlink();(old/'manifest.json').write_text(json.dumps(m))
        self.assertEqual(b.validate_package(old)['manifest_version'],1)
        new=self.root/'v2';b.build(new,previous_site=old)
        rollback=self.root/'rollback';r=b.build_rollback(rollback,old,new)
        self.assertEqual(r['manifest_version'],1);b.validate_package(rollback)
        self.assertEqual((rollback/'index.html').read_bytes(),(old/'index.html').read_bytes())
    def test_preview_adapter_is_not_in_production_bundle(self):
        site=self.root/'candidate';m=b.build(site)
        data=(site/m['entry']['bundle'].split('?')[0]).read_text()
        self.assertIn('window.IASDPISchedules=',data)
        self.assertNotIn('window.IASDPISchedulePreview=',data)
        self.assertNotIn('Participante de demonstração',data)
    def test_original_manual_agenda_and_organization_not_migrated(self):
        site=self.root/'candidate';b.build(site)
        for name in ['agenda-data.js','agenda.js','organization.js']:
            self.assertEqual((site/name).read_bytes(),(b.ROOT/'frontend'/name).read_bytes())
        sql=(b.ROOT/'database/005_schedule_foundation.sql').read_text()
        self.assertNotIn('INSERT INTO public.schedule_people',sql.split('-- Somente departamentos:')[1])
