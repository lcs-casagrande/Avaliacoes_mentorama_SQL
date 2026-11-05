"""G10.4: ensaio 004→026/recuperação somente em PG descartável sem rede."""
import copy,json,sys,subprocess,unittest,uuid
from pathlib import Path
import test_user_management_sql as base
import test_operational_sql as core
import test_access_governance_sql as g3
import test_church_isolation_sql as g1
import test_alias_login_sql as g2
import test_g9_lifecycle_sql as g9
import compare_g9_snapshots as compare
sys.path.insert(0,str(base.ROOT/'scripts'))
import prepare_g10_4_installation as plan
OUT=base.ROOT/'dist/governance-g10-4'
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável com --network none')
class G104InstallationSQLTests(unittest.TestCase):
 setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
 sql=base.UserManagementSQLTests.sql;command=g3.AccessGovernanceSQLTests.command;quote=staticmethod(core.OperationalSQLTests.quote);rpc=g1.ChurchIsolationSQLTests.rpc;grant=g3.AccessGovernanceSQLTests.grant;service=g2.AliasLoginSQLTests.service
 snapshot=g9.G9LifecycleSQLTests.snapshot;digests=g9.G9LifecycleSQLTests.digests;call=core.OperationalSQLTests.call
 def setUp(self):
  self.church='IASD_PI';self.iat=None;core.OperationalSQLTests.setUp(self)
  self.sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN;END IF;END $$")
  self.p['id']='g104-synthetic-finalized';self.p['plan']['name']='Culto sintético G10.4';self.call()
  self.sql((base.ROOT/'database/004_culto_trash.sql').read_text());trash=copy.deepcopy(self.p);trash.update(id='g104-synthetic-trash',status='Planejamento',executions={},actual_details={});self.call(trash);self.rpc('iasdpi_trash_program',[trash['id'],1,str(uuid.uuid4()),'Registro exclusivamente sintético'])
  self.baseline=self.snapshot();self.before=self.baseline['core_fingerprints'];OUT.mkdir(parents=True,exist_ok=True)
 def dump(self,name):
  data=subprocess.run(self.docker+['exec',base.CONTAINER,'pg_dump','-Fc','-U','postgres','-d',self.db],env=self.env,capture_output=True,check=True).stdout;(OUT/name).write_bytes(data);return data
 def restore(self,data):
  name='iasdpi_g104_restore_'+uuid.uuid4().hex;self.sql('create database '+name,database='postgres');self.addCleanup(self.sql,'drop database '+name+' with (force)',database='postgres')
  p=subprocess.run(self.docker+['exec','-i',base.CONTAINER,'pg_restore','--exit-on-error','-U','postgres','-d',name],input=data,env=self.env,capture_output=True);self.assertEqual(p.returncode,0,p.stderr.decode());return name
 def apply(self,step):
  self.sql((base.ROOT/step['file']).read_text())
  for check in step['checks']:self.assertEqual(self.sql((base.ROOT/check['file']).read_text()),'',check['file'])
  self.assertEqual(self.before,self.snapshot()['core_fingerprints'],step['file'])
 def test_01_chain_from_reported_core_shape_with_each_checkpoint_and_restore(self):
  self.assertEqual(len(self.baseline['relations']),12);self.assertEqual(len(self.baseline['functions']),22)
  self.assertEqual(self.sql("select exists(select 1 from pg_roles where rolname='iasdpi_church_executor')"),'f')
  before_digest=self.digests();baseline_dump=self.dump('synthetic-core-004.dump');steps=[]
  for step in plan.inventory()['steps']:
   self.apply(step);steps.append({'migration':step['migration'],'file':step['file'],'sha256':step['sha256'],'checks_passed':[c['file'] for c in step['checks']],'core_data_preserved':True});(OUT/'rehearsal.json').write_text(json.dumps({'baseline':'Sintética 001–004, Auth stub, 12 tabelas/22 funções; não é cópia de produção.','steps':steps,'complete':False,'supabase_accessed':False},ensure_ascii=False,indent=2)+'\n')
  for f in plan.inventory()['final_checks']:self.assertEqual(self.sql((base.ROOT/f).read_text()),'',f)
  self.assertEqual(self.sql("select count(*) from public.schedule_people"),'0');self.assertEqual(self.sql('select count(*) from auth.users'),'7');self.assertEqual(self.sql("select string_agg(code,',') from public.iasdpi_list_churches()",anonymous=True),'IASD_PI')
  self.sql('select * from public.iasdpi_programs',anonymous=True,fail=True);self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.U),'0')
  after_record=copy.deepcopy(self.p);after_record['id']='g104-synthetic-after-upgrade';saved=self.call(after_record);self.assertEqual(saved['document']['version'],1)
  final_digest=self.digests();final_schema=self.snapshot();final_dump=self.dump('synthetic-final-026.dump');original=self.db
  restored=self.restore(final_dump);self.db=restored;self.assertEqual(final_digest,self.digests());self.assertEqual(final_schema['core_fingerprints'],self.snapshot()['core_fingerprints']);self.assertTrue(compare.compare(final_schema,self.snapshot())['structure_matches'],'Schema/ACL/funções divergentes após restore local')
  for f in plan.inventory()['final_checks']:self.assertEqual(self.sql((base.ROOT/f).read_text()),'',f)
  self.sql('select public.iasdpi_governance_history(0)',anonymous=True,fail=True);self.assertIsInstance(self.rpc('iasdpi_governance_history',[0],base.A),list);self.rpc('iasdpi_governance_history',[0],base.L,True)
  restored_core=self.restore(baseline_dump);self.db=restored_core;self.assertEqual(before_digest,self.digests());self.assertEqual(len(self.snapshot()['relations']),12);self.db=original
  evidence={'baseline':'Sintética; sem dados de produção.','complete':True,'steps':steps,'stage_count':len(steps),'core_data_preserved_each_stage':True,'executor_absent_before_chain':True,'no_auth_accounts_created_by_migrations':True,'people_not_automatically_imported':True,'core_write_compatible_after_026':True,'final_backup_restored':True,'baseline_backup_restored':True,'all_final_table_data_digests_equal':True,'restored_schema_functions_and_acl_equal':True,'administrator_only_audit_after_restore':True,'tables_compared_after_final_restore':len(final_digest),'private_access_denied_after_restore':True,'restore_limit':'Mesmo cluster/roles já presentes; não comprova GoTrue, Storage, SMTP, JWT ou restore gerenciado do Supabase.','supabase_accessed':False}
  (OUT/'rehearsal.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
 def test_02_missing_predecessor_rolls_back_and_keeps_core(self):
  self.sql((base.ROOT/'database/005_schedule_foundation.sql').read_text());self.sql((base.ROOT/'database/007_daily_schedules.sql').read_text(),fail=True);self.assertEqual(self.before,self.snapshot()['core_fingerprints']);self.assertEqual(self.sql("select to_regclass('public.schedule_settings') is null"),'t');self.assertEqual(self.sql("select to_regclass('public.schedule_events') is null"),'t')
 def test_03_check_failure_stops_next_stage_without_undoing_committed_stage(self):
  steps=plan.inventory()['steps'][:2];steps[0]={**steps[0],'checks':[{'file':'check-missing-for-test.sql'}]}
  with self.assertRaises(FileNotFoundError):
   for step in steps:self.apply(step)
  self.assertEqual(self.sql("select to_regclass('public.schedule_people') is not null"),'t');self.assertEqual(self.sql("select to_regclass('public.schedule_plans') is null"),'t');self.assertEqual(self.before,self.snapshot()['core_fingerprints'])
 def test_04_reapplying_foundation_is_rejected_without_deleting_records(self):
  self.sql((base.ROOT/'database/005_schedule_foundation.sql').read_text());before=self.digests();self.sql((base.ROOT/'database/005_schedule_foundation.sql').read_text(),fail=True);self.assertEqual(before,self.digests())
