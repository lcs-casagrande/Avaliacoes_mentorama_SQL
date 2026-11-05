"""Inspeção de artefatos preparados; NÃO aplica SQL nem substitui teste PostgreSQL."""
from pathlib import Path
import re,unittest
ROOT=Path(__file__).resolve().parents[1]
class InstitutionalContractTests(unittest.TestCase):
 def setUp(self):self.sql=(ROOT/'database/028_institutional_access.sql').read_text()
 def test_existing_identity_sources_and_private_aliases_reused(self):
  self.assertNotRegex(self.sql,r'(?i)CREATE\s+TABLE');self.assertIn('ALTER TABLE iasdpi_admin_private.login_aliases',self.sql);self.assertIn('REFERENCES public.schedule_people(church_id,id)',self.sql)
 def test_no_history_auth_deletion_or_password_columns(self):
  self.assertNotRegex(self.sql,r'(?i)\b(DELETE\s+FROM|DROP\s+TABLE|TRUNCATE)\b');self.assertNotIn('INSERT INTO auth.users',self.sql);self.assertNotRegex(self.sql,r'(?i)ADD COLUMN\s+(password|token)\b')
 def test_server_locks_versions_admin_and_context(self):
  self.assertIn('iasdpi_admin_private.lock_admin()',self.sql);self.assertIn('FOR UPDATE',self.sql);self.assertIn('r.version IS DISTINCT FROM p_expected_version',self.sql);self.assertIn("USING errcode='42501'",self.sql)
 def test_shared_reader_backend_guards_and_published_only(self):
  for value in ['shared_institutional_reader','shared_institutional_guard','shared_published_only','iasdpi_events_published(p_month)',"'published_only',true",'iasdpi_schedule_plan_version']:self.assertIn(value,self.sql)
 def test_role_and_approval_are_not_frontend_freeform(self):
  signature=re.search(r'CREATE FUNCTION public.iasdpi_institutional_save\((.*?)\) RETURNS',self.sql,re.S).group(1)
  for name in ['p_role','p_flags','p_user','p_kind']:self.assertNotIn(name,signature)
  self.assertIn("r.slot_kind<>'elder'",self.sql);self.assertIn('p_confirm_elevated',signature)
 def test_old_alias_route_cannot_bypass_handoff(self):
  self.assertIn('Use a tabela institucional',self.sql);self.assertIn('require_password_change(target',self.sql);self.assertIn('institutional_slot_immutable',self.sql)
 def test_optional_configuration_disabled_in_operational_source(self):
  self.assertNotIn('institutionalAccessEnabled:true',(ROOT/'frontend/config.js').read_text());self.assertIn('IASDPI_INSTITUTIONAL_ENABLED=false',(ROOT/'docs/existing-supabase-edge.env.example').read_text())
 def test_no_private_material_in_new_assets(self):
  for f in ['frontend/governance.js','tests/fixtures/institutional-access-preview.js','database/028_institutional_access.sql']:
   s=(ROOT/f).read_text();self.assertNotRegex(s,r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY');self.assertNotRegex(s,r'\bsb_secret_[A-Za-z0-9]+')
