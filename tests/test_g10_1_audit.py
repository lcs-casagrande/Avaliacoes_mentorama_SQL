"""Auditoria offline; não acessa Supabase nem classifica banco não inventariado."""
import importlib.util,json,re,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import prepare_g10_1_audit as audit
class G101AuditPreparationTests(unittest.TestCase):
 def test_all_migrations_have_unique_forward_hash_and_unconfirmed_remote_status(self):
  d=audit.inventory();self.assertEqual([s['number'] for s in d['steps']],list(range(1,26)));self.assertTrue(all(s['remote_status']=='indeterminada' for s in d['steps']));self.assertFalse(d['real_inventory_received']);self.assertFalse(d['definitive_installation_sql_prepared']);self.assertTrue(all(re.fullmatch('[0-9a-f]{64}',s['sha256']) for s in d['steps']))
 def test_existing_g9_notes_reused_and_new_published_dependencies_explicit(self):
  d=audit.inventory();self.assertTrue(all(s['purpose']==audit.G9_NOTES[s['number']] for s in d['steps'] if s['number'] in audit.G9_NOTES));self.assertTrue(all(s['scope']=='Dependência adicional da versão publicada' for s in d['steps'][21:]));self.assertIn('aprovação',d['steps'][24]['purpose'])
 def test_inventory_is_one_select_without_mutations_business_scans_or_app_calls(self):
  s=(ROOT/'database/check_g10_1_inventory.sql').read_text();sql=re.sub(r'--[^\n]*','',s);self.assertTrue(sql.lstrip().startswith('WITH'));self.assertEqual(sql.count(';'),1)
  self.assertIsNone(re.search(r'\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|DO|CALL|EXECUTE|COPY|GRANT|REVOKE)\b',re.sub(r"'(?:''|[^'])*'",'',sql),re.I))
  self.assertNotIn('query_to_xml',sql);self.assertIsNone(re.search(r'\b(?:FROM|JOIN)\s+(?:public|auth|iasdpi_\w+)\.',sql,re.I));self.assertIsNone(re.search(r'\b(?:public|iasdpi_\w+)\.\w+\(',re.sub(r"'(?:''|[^'])*'",'',sql),re.I))
 def test_inventory_has_grants_policies_dependencies_hashes_and_no_full_definitions(self):
  s=(ROOT/'database/check_g10_1_inventory.sql').read_text()
  for term in ['pg_default_acl','pg_auth_members','pg_depend','has_column_privilege','has_function_privilege','pg_policies','pg_trigger','pg_index','pg_constraint','md5(pg_get_functiondef','transaction_read_only','auth_provider_settings_verified','migration_execution_proven','value_md5']:self.assertIn(term,s)
  self.assertNotIn("'settings',p.proconfig",s);self.assertNotIn('encrypted_password',s)
