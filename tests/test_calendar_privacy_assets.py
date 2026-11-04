"""Ausência de escalas e fontes privadas no pacote operacional público."""
import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import calendar_privacy as privacy
class CalendarPrivacyAssetTests(unittest.TestCase):
    def contents(self):return {n:(ROOT/'frontend'/n).read_bytes() for n in ['agenda.js','agenda-data.js']}
    def test_strip_private_static_data_preserve_only_elder_periods(self):
        original=self.contents();saved=copy.deepcopy(original);result=privacy.sanitize(original);privacy.validate(result)
        self.assertEqual(original,saved);self.assertTrue(all(e['kind'] in ['weekly','monthly'] for e in privacy.snapshot(result['agenda-data.js'])['events']));self.assertIn(b"const ministrySchedules={'",result['agenda.js']);self.assertNotIn(b"person:'Mini Lucas'",result['agenda.js'])
    def test_unsanitized_snapshot_is_rejected(self):
        with self.assertRaises(ValueError):privacy.validate(self.contents())
    def test_tampered_manual_source_is_rejected(self):
        values=privacy.sanitize(self.contents());values['agenda.js']=values['agenda.js'].replace(b"'Sonoplastia':[]",b"'Sonoplastia':[{person:'privado'}]")
        with self.assertRaises(ValueError):privacy.validate(values)
    def test_unknown_structure_is_not_silently_built(self):
        values=self.contents();values['agenda.js']=b'const renamed = {};'
        with self.assertRaises(ValueError):privacy.sanitize(values)

    def test_source_inventory_keeps_twenty_historical_rows_pending(self):
        import prepare_calendar_source_review as review
        values=review.prepare();self.assertEqual(len(values['schedules']),20);self.assertEqual(len({r['source_key'] for r in values['schedules']}),20)
        self.assertEqual(sum(r['department']=='Sonoplastia' for r in values['schedules']),15);self.assertEqual(sum(r['department']=='Comunicação' for r in values['schedules']),5)
        self.assertTrue(all(r['person_id'] is None for r in values['schedules']));self.assertTrue(all(r['program_category'] is None for r in values['events']));self.assertFalse(values['safe_to_apply'])
    def test_operational_package_is_sanitized_and_validated(self):
        import tempfile
        import build_homologation as build
        cfg={'supabaseUrl':'https://privacysample.supabase.co','supabasePublishableKey':'sb_publishable_fictitious_testing_only_123456789','churchIsolationEnabled':True,'aliasLoginEnabled':True,'governanceEnabled':True,'portalAccessEnabled':True,'centralRegistryEnabled':True,'eventsEnabled':True,'calendarPrivacyEnabled':True}
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'site';m=build.build(target,site_url='https://preview.example.test/calendar/',real_homologation=True,public_config=cfg)
            self.assertTrue(m['calendar_privacy']);build.validate_package(target)
            privacy.validate({n:(target/n).read_bytes() for n in ['agenda.js','agenda-data.js']})

    def test_retained_old_javascript_cannot_reintroduce_private_rows(self):
        values=privacy.sanitize(self.contents());values['assets/old.js']=self.contents()['agenda.js']
        with self.assertRaisesRegex(ValueError,'Recurso antigo'):privacy.validate(values)

    def test_rollback_cannot_restore_previous_public_private_schedules(self):
        import tempfile
        import build_homologation as build
        cfg={'supabaseUrl':'https://privacysample.supabase.co','supabasePublishableKey':'sb_publishable_fictitious_testing_only_123456789','churchIsolationEnabled':True,'aliasLoginEnabled':True,'governanceEnabled':True,'portalAccessEnabled':True,'eventsEnabled':True}
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);old=root/'old';current=root/'current'
            build.build(old,site_url='https://preview.example.test/calendar/',real_homologation=True,public_config=cfg)
            build.build(current,site_url='https://preview.example.test/calendar/',real_homologation=True,public_config={**cfg,'calendarPrivacyEnabled':True})
            with self.assertRaisesRegex(ValueError,'voltaria a expor'):build.build_rollback(root/'rollback',old,current)
