"""Inventário executado só em PostgreSQL descartável, incluindo banco vazio/parcial."""
import json,unittest,uuid
import test_user_management_sql as base
import test_event_planning_sql as events
QUERY=(base.ROOT/'database/check_g10_1_inventory.sql').read_text()
def run_inventory(case):
 return json.loads(case.sql("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL statement_timeout='30s';"+QUERY+'ROLLBACK;'))
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G101EmptyInventorySQLTests(unittest.TestCase):
 setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__);command=base.UserManagementSQLTests.command;sql=base.UserManagementSQLTests.sql
 def setUp(self):
  self.db='iasdpi_inventory_'+uuid.uuid4().hex;self.sql('create database '+self.db,database='postgres');self.addCleanup(self.sql,'drop database '+self.db+' with (force)',database='postgres')
 def inventory(self):return run_inventory(self)
 def test_database_without_auth_or_iasdpi_schemas_is_inventoried_without_error(self):
  d=self.inventory();self.assertEqual(d['format'],'IASDPI_G10_1_SCHEMA_INVENTORY');self.assertEqual(d['transaction_read_only'],'on');self.assertEqual(d['transaction_isolation'],'repeatable read');self.assertFalse(any(m['present'] for m in d['markers']));self.assertEqual(d['relations'],[]);self.assertFalse(d['auth_primitives']['users_table']);self.assertFalse(d['migration_ledger']['present'])
 def test_unknown_objects_insecure_grants_and_hidden_values_are_detected_without_mutation(self):
  self.sql("""create table public.extra_audit(id bigint generated always as identity,private_value text default 'SYNTHETIC_DEFAULT_NEVER_EXPORT');
    insert into public.extra_audit(private_value) values('SYNTHETIC_ROW_NEVER_EXPORT');
    grant select on public.extra_audit to anon;
    create policy hidden_policy on public.extra_audit using(private_value<>'SYNTHETIC_POLICY_NEVER_EXPORT');
    create function public.iasdpi_audit_canary() returns text language sql security definer set search_path='' set app.audit_secret='SYNTHETIC_CONFIG_NEVER_EXPORT' as $$select 'SYNTHETIC_BODY_NEVER_EXPORT'::text$$;""")
  d=self.inventory();raw=json.dumps(d);r=next(r for r in d['relations'] if r['name']=='public.extra_audit');self.assertFalse(r['rls']);self.assertTrue(r['privileges']['anon']['select']);self.assertEqual(len(r['policies']),1)
  for token in ['SYNTHETIC_DEFAULT_NEVER_EXPORT','SYNTHETIC_ROW_NEVER_EXPORT','SYNTHETIC_POLICY_NEVER_EXPORT','SYNTHETIC_CONFIG_NEVER_EXPORT','SYNTHETIC_BODY_NEVER_EXPORT']:self.assertNotIn(token,raw)
  f=next(f for f in d['functions'] if f['name']=='iasdpi_audit_canary');secret=next(x for x in f['settings'] if x['name']=='app.audit_secret');self.assertIsNone(secret['value']);self.assertTrue(secret['value_md5']);self.assertTrue(any(x['grantee']=='PUBLIC' for x in f['acl']));self.assertTrue(any(r['kind']=='S' for r in d['relations']));self.assertEqual(self.sql('select count(*) from public.extra_audit'),'1');self.assertEqual(self.sql('show transaction_read_only'),'off')
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G101CoreInventorySQLTests(unittest.TestCase):
 setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__);command=base.UserManagementSQLTests.command;sql=base.UserManagementSQLTests.sql
 def setUp(self):
  base.UserManagementSQLTests.setUp(self)
  for f in ['003_operational_storage.sql','004_culto_trash.sql']:self.sql((base.ROOT/'database'/f).read_text())
 def test_core_001_004_does_not_imply_any_later_migration(self):
  d=run_inventory(self);self.assertEqual({m['number'] for m in d['markers'] if m['present']},{1,2,3,4});self.assertTrue(d['auth_primitives']['uid_function']);self.assertFalse(d['migration_execution_proven']);self.assertFalse(d['business_data_read'])
 def test_011_core_only_is_identified_without_calling_church_rpc(self):
  self.sql((base.ROOT/'database/011_church_isolation.sql').read_text());before=self.sql('select revision from iasdpi_admin_private.control');d=run_inventory(self);self.assertEqual({m['number'] for m in d['markers'] if m['present']},{1,2,3,4,11});self.assertEqual(before,self.sql('select revision from iasdpi_admin_private.control'));self.assertTrue(any(r['name']=='iasdpi_church_executor' and not r['bypassrls'] for r in d['roles']))
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G101FullInventorySQLTests(unittest.TestCase):
 setUpClass=classmethod(events.EventPlanningSQLTests.setUpClass.__func__);command=events.EventPlanningSQLTests.command;sql=events.EventPlanningSQLTests.sql
 quote=staticmethod(events.EventPlanningSQLTests.quote);rpc=events.EventPlanningSQLTests.rpc;snapshot=events.EventPlanningSQLTests.snapshot;grant=events.EventPlanningSQLTests.grant;service=events.EventPlanningSQLTests.service
 def setUp(self):
  events.EventPlanningSQLTests.setUp(self)
  for f in ['023_schedule_edit_window.sql','024_schedule_publication_rules.sql','025_event_direct_publication.sql']:self.sql((base.ROOT/'database'/f).read_text())
 def test_full_published_schema_including_private_backups_is_read_without_app_rpc(self):
  self.sql('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);')
  before=self.sql("select jsonb_build_array((select revision from iasdpi_admin_private.control),(select count(*) from iasdpi_operational_private.receipts),(select count(*) from public.schedule_people))")
  d=run_inventory(self);self.assertTrue(all(m['present'] for m in d['markers']));self.assertTrue(d['migration_ledger']['present']);self.assertFalse(d['migration_ledger']['rows_read']);self.assertEqual({x['name'] for x in d['migration_ledger']['columns']},{'version','name','statements'});self.assertTrue(d['dependencies']);self.assertFalse(d['edge_deployments_verified']);self.assertTrue(any(f['name']=='iasdpi_event_submit' and not f['execute']['anon'] for f in d['functions']));self.assertTrue(any(r['name']=='public.iasdpi_event_reservations' and r['rls'] for r in d['relations']))
  self.assertEqual(before,self.sql("select jsonb_build_array((select revision from iasdpi_admin_private.control),(select count(*) from iasdpi_operational_private.receipts),(select count(*) from public.schedule_people))"))
