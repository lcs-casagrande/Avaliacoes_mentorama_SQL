"""G9: preparação offline de pacote e classificação de inventários, sem Supabase."""
import copy,importlib.util,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import build_homologation as build
import compare_g9_snapshots as compare
CFG={'supabaseUrl':'https://g9hmltest.supabase.co','supabasePublishableKey':'sb_publishable_fictitious_hml_only_1234567890',**{k:True for k in ['churchIsolationEnabled','aliasLoginEnabled','governanceEnabled','portalAccessEnabled','centralRegistryEnabled']}}
SITE='https://iasdpi-hml.example.org/portal/'
class G9PackageTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.out=Path(self.tmp.name)/'package'
    def test_isolated_real_hml_package_valid_and_original_config_unchanged(self):
        before=(ROOT/'frontend/config.js').read_bytes();m=build.build(self.out,SITE,real_homologation=True,public_config=CFG);build.validate_package(self.out);self.assertEqual(before,(ROOT/'frontend/config.js').read_bytes());cfg=json.loads((self.out/'config.js').read_text().split('Object.freeze(',1)[1].split(');',1)[0]);self.assertEqual(cfg['storageMode'],'supabase');self.assertEqual(cfg['storageNamespace'],'iasdpi-hml-real-v1');self.assertFalse(cfg['remoteReadOnly']);self.assertEqual(m['environment'],'homologation');self.assertEqual(cfg['supabaseUrl'],CFG['supabaseUrl'])
    def test_both_known_production_projects_are_rejected(self):
        for host in ['pwbxksxxmnblqwpvlheu','chzltoqifqgylgkxbwuk']:
            with self.assertRaisesRegex(ValueError,'produção'):build.build(self.out,SITE,real_homologation=True,public_config={**CFG,'supabaseUrl':'https://'+host+'.supabase.co'})
        self.assertFalse(self.out.exists())
    def test_main_site_and_unsafe_modes_are_rejected(self):
        with self.assertRaises(ValueError):build.build(self.out,'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/',real_homologation=True,public_config=CFG)
        with self.assertRaises(ValueError):build.build(self.out,'https://lcs-casagrande.github.io/IASDPI-homologacao/',real_homologation=True,public_config=CFG)
        for flags in [{'preserve_local':True},{'operational':True}]:
            with self.assertRaises(ValueError):build.build(self.out,SITE,real_homologation=True,public_config=CFG,**flags)
        with self.assertRaises(ValueError):build.build(self.out,SITE,public_config=CFG)
        self.assertFalse(self.out.exists())
    def test_secret_or_extra_private_fields_rejected_before_writing(self):
        for cfg in [{**CFG,'supabasePublishableKey':'sb_secret_fictitious_invalid_123456789'},{**CFG,'service_role':'fictitious-value-not-secret'}]:
            with self.assertRaises(ValueError):build.build(self.out,SITE,real_homologation=True,public_config=cfg)
        self.assertFalse(self.out.exists())
    def test_readonly_default_preserved(self):
        m=build.build(self.out,SITE);self.assertTrue(m['remote_read_only']);self.assertEqual(m['storage_namespace'],'iasdpi-homologacao-v1')
    def test_rollback_preserves_new_hml_namespace_and_integrity(self):
        build.build(self.out,SITE,real_homologation=True,public_config=CFG);second=self.out.parent/'second';build.build(second,SITE,real_homologation=True,public_config=CFG,previous_site=self.out);rollback=self.out.parent/'rollback';build.build_rollback(rollback,self.out,second);build.validate_package(rollback);self.assertEqual((rollback/'index.html').read_bytes(),(self.out/'index.html').read_bytes())
class G9InventoryTests(unittest.TestCase):
    def snapshot(self,installed):return {'format':'IASDPI_G9_SCHEMA_SNAPSHOT','version':1,'markers':[{'number':i,'present':i in installed} for i in range(1,20)],'relations':[],'functions':[],'schemas':[]}
    def test_only_004_is_candidate_not_automatic_authorization(self):self.assertEqual(compare.readiness(self.snapshot(range(1,5)))['state'],'core_004_candidate')
    def test_core_church_before_schedules_and_partial_install_block_default_plan(self):
        self.assertEqual(compare.readiness(self.snapshot([1,2,3,4,11]))['state'],'church_before_schedules');self.assertFalse(compare.readiness(self.snapshot(range(1,13)))['can_plan_005_019'])
    def test_final_markers_do_not_allow_reapplication(self):self.assertFalse(compare.readiness(self.snapshot(range(1,20)))['can_plan_005_019'])
    def test_structure_comparison_does_not_compare_production_data_to_fixtures(self):
        a=self.snapshot(range(1,20));b=copy.deepcopy(a);a['core_fingerprints']={'example':{'rows':2,'digest':'fictitious'}};b['core_fingerprints']={'example':{'rows':20,'digest':'different'}};self.assertTrue(compare.compare(a,b)['structure_matches'])
