"""A G10.3 não ativa flags nem contorna o bloqueio do gerador contra produção."""
import json,tempfile,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import build_homologation as build
from test_g9_preparation import CFG,SITE
class G103PackageTests(unittest.TestCase):
 def test_new_policy_flag_is_public_optional_and_no_server_code_is_packaged(self):
  before=(ROOT/'frontend/config.js').read_bytes()
  with tempfile.TemporaryDirectory() as temp:
   out=Path(temp)/'site';build.build(out,SITE,real_homologation=True,public_config={**CFG,'responsibilityGovernanceEnabled':True});build.validate_package(out);self.assertIn('"responsibilityGovernanceEnabled": true',(out/'config.js').read_text());self.assertFalse(any(p.name=='credentials.mjs' for p in out.rglob('*')))
  self.assertEqual(before,(ROOT/'frontend/config.js').read_bytes())
 def test_invalid_flag_or_missing_authenticated_governance_is_rejected(self):
  for patch in [{'responsibilityGovernanceEnabled':'true'},{'responsibilityGovernanceEnabled':True,'governanceEnabled':False}]:
   with tempfile.TemporaryDirectory() as temp:
    with self.assertRaises(ValueError):build.build(Path(temp)/'site',SITE,real_homologation=True,public_config={**CFG,**patch})
 def test_existing_iasd_parada_project_is_still_blocked_by_hml_builder(self):
  with tempfile.TemporaryDirectory() as temp:
   with self.assertRaisesRegex(ValueError,'produção'):build.build(Path(temp)/'site',SITE,real_homologation=True,public_config={**CFG,'responsibilityGovernanceEnabled':True,'supabaseUrl':'https://pwbxksxxmnblqwpvlheu.supabase.co'})
