"""G7: schema completo em template descartável, sem rede ou Supabase real."""
import json
import subprocess
import unittest
import uuid
import test_elder_storage_sql as g5
import test_user_management_sql as base
import test_church_isolation_sql as g1
import test_access_governance_sql as g3
D=g1.D;M='a0000000-0000-4000-8000-000000000003'

class LatestSchemaMixin:
    @classmethod
    def setUpClass(cls):
        base.UserManagementSQLTests.setUpClass.__func__(cls)
        proto=cls('runTest');g5.ElderStorageSQLTests.setUp(proto)
        cls.template15=proto.db;cls.addClassCleanup(proto.doCleanups)
        cls.template16='iasdpi_template_'+uuid.uuid4().hex
        proto.sql('create database '+cls.template16+' template '+cls.template15,database='postgres')
        cls.addClassCleanup(proto.sql,'drop database '+cls.template16+' with (force)',database='postgres')
        proto.sql((base.ROOT/'database/016_department_schedule_days.sql').read_text(),database=cls.template16)
    def setUp(self):
        self.church='IASD_PI';self.iat=None;self.db='iasdpi_test_'+uuid.uuid4().hex
        self.sql('create database '+self.db+' template '+self.template16,database='postgres')
        self.addCleanup(self.sql,'drop database '+self.db+' with (force)',database='postgres')
    def use15(self):
        self.db='iasdpi_test_'+uuid.uuid4().hex;self.sql('create database '+self.db+' template '+self.template15,database='postgres');self.addCleanup(self.sql,'drop database '+self.db+' with (force)',database='postgres')
    sql=base.UserManagementSQLTests.sql
    command=g3.AccessGovernanceSQLTests.command
    rpc=g1.ChurchIsolationSQLTests.rpc
    quote=staticmethod(g1.ChurchIsolationSQLTests.quote)
    grant=g3.AccessGovernanceSQLTests.grant

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class DepartmentDaysSQLTests(LatestSchemaMixin,unittest.TestCase):
    def get(self,d=D,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_department_days',[d],actor,fail)
    def save_days(self,days,version=None,d=D,actor=base.A,request=None,fail=False):
        v=self.get(d)['version'] if version is None else version
        literal='null::smallint[]' if days is None else 'ARRAY['+','.join('null' if x is None else str(x) for x in days)+']::smallint[]'
        query='select public.iasdpi_schedule_department_days_save(%s,%s,%s,%s)'%(self.quote(d),'null' if v is None else str(v),literal,self.quote(request or str(uuid.uuid4())))
        raw=self.sql(query,actor=actor,fail=fail);return None if fail else json.loads(raw)
    def digest(self,table):return self.sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) from "+table+' t')
    def test_default_persistence_and_independent_departments(self):
        self.assertEqual(set(self.get()['weekdays']),{0,3,6});before=self.get(M)
        row=self.save_days([6]);self.assertEqual(row,self.get());self.assertEqual(before,self.get(M));self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='department-days'"),'1')
    def test_department_administration_required_not_just_edit_or_publish(self):
        self.grant(flags={'view':True,'edit':True,'publish':True});self.save_days([6],actor=base.U,fail=True)
        self.grant(flags={'members':True},version=1);self.save_days([6],actor=base.U)
        self.save_days([6],d=M,actor=base.U,fail=True)
        self.grant(status='revoked',version=2);self.save_days([0],actor=base.U,fail=True)
        self.sql("select public.iasdpi_schedule_department_days('%s')"%D,anonymous=True,fail=True)
    def test_invalid_arrays_empty_and_stale_version(self):
        for days in [[7],[0,0],[None],[-1],None]:self.save_days(days,version=1,fail=True)
        row=self.save_days([],version=1);self.assertEqual(row['weekdays'],[]);self.save_days([0],version=1,fail=True)
    def test_generation_uses_department_days_without_deleting_old_events(self):
        self.save_days([6]);r=self.rpc('iasdpi_schedule_generate_days',[D,'Culto G7',str(uuid.uuid4())]);self.assertGreater(len(r['events']),0)
        import datetime
        self.assertTrue(all(datetime.date.fromisoformat(e['scheduled_on']).weekday()==5 for e in r['events']))
        before=self.digest('public.schedule_events');self.save_days([]);empty=self.rpc('iasdpi_schedule_generate_days',[D,'Culto G7',str(uuid.uuid4())]);self.assertEqual(empty['events'],[]);self.assertEqual(before,self.digest('public.schedule_events'))
        ctx=self.rpc('iasdpi_schedule_rotation_context',[D,r['months'][0]]);self.assertEqual(ctx['planning_weekdays'],[])
    def test_idempotent_retry_and_version_race(self):
        req=str(uuid.uuid4());a=self.save_days([6],version=1,request=req);self.assertEqual(a,self.save_days([6],version=1,request=req));self.save_days([0],version=1,request=req,fail=True)
        processes=[]
        for day in [0,3]:
            source="select public.iasdpi_schedule_department_days_save('%s',2,ARRAY[%d]::smallint[],'%s')"%(D,day,uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(source,base.A));p.stdin.close();p.stdin=None;processes.append(p)
        outputs=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs)
    def test_config_changes_preserve_published_plan_and_versions(self):
        # A gravação manual existente em quarta-feira não é invalidada ao escolher sábados.
        p=g5.ElderStorageSQLTests.person(self)
        plan=g5.ElderStorageSQLTests.daily(self,p)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())])
        tables=['public.schedule_plans','public.schedule_requirements','public.schedule_assignments','public.schedule_versions','public.culto_archives','public.iasdpi_access']
        before={t:self.digest(t) for t in tables};self.save_days([6]);self.assertEqual(before,{t:self.digest(t) for t in tables})
    def test_rls_checks_and_private_helpers(self):
        for name in ['check_church_isolation.sql','check_access_governance.sql','check_portal_integration.sql','check_governance_integration.sql','check_department_schedule_days.sql']:
            self.assertEqual(self.sql((base.ROOT/'database'/name).read_text()),'',name)
        self.sql('select iasdpi_schedule_private.can_configure_days(auth.uid(),null)',actor=base.A,fail=True)
        self.sql('update public.schedule_departments set planning_weekdays=ARRAY[0]::smallint[]',actor=base.A,fail=True)
    def test_settings_view_is_scoped_and_legacy_global_changes_are_not_silent(self):
        self.grant(flags={'view':True,'members':True});s=self.rpc('iasdpi_schedule_settings_get',[],base.U)
        self.assertEqual(set(s['department_weekdays']),{D});self.assertTrue(s['department_days_can_edit'][D]);self.assertNotIn(M,s['department_weekdays'])
        self.rpc('iasdpi_schedule_settings_save',[s['version'],{'weekdays':[1]}],fail=True)
    def test_new_departments_default_and_legacy_custom_choice_preserved(self):
        self.use15();s=self.rpc('iasdpi_schedule_settings_get',[]);self.rpc('iasdpi_schedule_settings_save',[s['version'],{'weekdays':[2,4]}])
        self.sql((base.ROOT/'database/016_department_schedule_days.sql').read_text());self.assertEqual(self.get()['weekdays'],[2,4])
        new=self.rpc('iasdpi_schedule_save',['department',str(uuid.uuid4()),0,{'name':'Departamento fictício G7','code':'g7teste'},str(uuid.uuid4())]);self.assertEqual(set(self.get(new['id'])['weekdays']),{0,3,6})
    def test_old_downs_refuse_later_versions_and_015_refuses_016(self):
        before=self.digest('public.iasdpi_access')
        for name in ['005_schedule_foundation_down.sql','006_schedule_management_down.sql','008_monthly_rotation_down.sql','015_elder_period_storage_down.sql']:self.sql((base.ROOT/'database'/name).read_text(),fail=True)
        self.assertEqual(before,self.digest('public.iasdpi_access'));self.assertTrue(self.get()['can_edit'])
    def test_empty_015_rollback_restores_014_and_preserves_previous_data(self):
        self.use15();tables=['public.iasdpi_access','public.culto_archives','public.schedule_departments','public.schedule_plans','public.schedule_versions']
        before={t:self.digest(t) for t in tables};self.sql((base.ROOT/'database/015_elder_period_storage_down.sql').read_text())
        self.assertEqual(before,{t:self.digest(t) for t in tables});self.assertEqual(self.sql("select to_regclass('public.schedule_elder_periods') is null"),'t')
        self.assertEqual(self.sql((base.ROOT/'database/check_portal_integration.sql').read_text()),'')
        self.sql((base.ROOT/'database/015_elder_period_storage.sql').read_text());self.assertTrue(self.rpc('iasdpi_schedule_settings_get',[])['elder_periods'])
    def test_015_with_any_period_or_history_refuses_without_partial_changes(self):
        self.use15();person=g5.ElderStorageSQLTests.person(self);w=self.rpc('iasdpi_schedule_elder_workspace',[g5.D,'2031-01-01',2031]);r=w['periods'][0]
        self.rpc('iasdpi_schedule_elder_save',[g5.D,'draft',[{k:r[k] for k in ['id','kind','starts_on','ends_on']}|{'person_id':person,'expected_version':0}],str(uuid.uuid4())])
        before=self.digest('public.schedule_elder_periods');self.sql((base.ROOT/'database/015_elder_period_storage_down.sql').read_text(),fail=True);self.assertEqual(before,self.digest('public.schedule_elder_periods'))
    def test_new_settings_rpc_rejects_another_church_and_preserves_primary(self):
        before=self.get();self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','OTHER','Igreja fictícia',true,true)"%g1.OTHER)
        self.church='OTHER';self.get(fail=True);self.save_days([6],version=1,fail=True);self.rpc('iasdpi_schedule_generate_days',[D,'Culto G7',str(uuid.uuid4())],fail=True);self.church='IASD_PI';self.assertEqual(before,self.get())
    def test_empty_015_with_custom_function_dependency_refuses(self):
        self.use15();self.sql("create function public.custom_elder_dependency() returns integer language sql as 'select count(*)::integer from public.schedule_elder_periods'")
        before=self.digest('public.iasdpi_access');self.sql((base.ROOT/'database/015_elder_period_storage_down.sql').read_text(),fail=True);self.assertEqual(before,self.digest('public.iasdpi_access'));self.assertEqual(self.sql("select to_regclass('public.schedule_elder_periods') is not null"),'t')
    def test_pg_dump_restore_retains_records_configs_versions_and_rls(self):
        self.save_days([6]);p=g5.ElderStorageSQLTests.person(self);g5.ElderStorageSQLTests.daily(self,p)
        w=self.rpc('iasdpi_schedule_elder_workspace',[g5.D,'2031-01-01',2031]);r=w['periods'][0]
        self.rpc('iasdpi_schedule_elder_save',[g5.D,'published',[{k:r[k] for k in ['id','kind','starts_on','ends_on']}|{'person_id':p,'expected_version':0}],str(uuid.uuid4())])
        tables=self.sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth') or schemaname like 'iasdpi_%' order by schemaname,tablename").splitlines()
        before={t:self.digest(t) for t in tables}
        dump=subprocess.run(self.docker+['exec',base.CONTAINER,'pg_dump','-Fc','-U','postgres','-d',self.db],capture_output=True,env=self.env,check=True).stdout
        restored='iasdpi_restore_'+uuid.uuid4().hex;self.sql('create database '+restored,database='postgres');self.addCleanup(self.sql,'drop database '+restored+' with (force)',database='postgres')
        result=subprocess.run(self.docker+['exec','-i',base.CONTAINER,'pg_restore','-U','postgres','--exit-on-error','-d',restored],input=dump,capture_output=True,env=self.env)
        self.assertEqual(result.returncode,0,result.stderr.decode());self.db=restored
        self.assertEqual(before,{t:self.digest(t) for t in tables});self.assertEqual(self.get()['weekdays'],[6]);self.assertEqual(self.sql((base.ROOT/'database/check_department_schedule_days.sql').read_text()),'')
        self.sql('select * from public.schedule_elder_periods',anonymous=True,fail=True)

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class G7ElderRegressionTests(LatestSchemaMixin,g5.ElderStorageSQLTests):
    """Casos G5 existentes reexecutados sobre a 016, sem duplicar a implementação."""

import test_governance_integration_sql as g6
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class G7GovernanceRegressionTests(LatestSchemaMixin,g6.GovernanceIntegrationSQLTests):
    """Matriz G6 reexecutada sobre a 016; expectativa do achado corrigido atualizada."""
    artifact_folder='governance-g7'
    def test_audit_department_weekdays_not_persisted_in_current_schema(self):
        d=self.create('department',{'code':'comunicacao','name':'Comunicação'})
        settings=self.rpc('iasdpi_schedule_settings_get',[]);self.assertEqual(set(settings['department_weekdays'][d['id']]),{0,3,6})
        row=self.rpc('iasdpi_schedule_department_days',[d['id']]);self.sql("select public.iasdpi_schedule_department_days_save('%s',%d,ARRAY[6]::smallint[],'%s')"%(d['id'],row['version'],uuid.uuid4()),actor=base.A)
        generated=self.rpc('iasdpi_schedule_generate_days',[d['id'],'Culto G7 Comunicação',str(uuid.uuid4())]);import datetime
        self.assertTrue(generated['events']);self.assertTrue(all(datetime.date.fromisoformat(e['scheduled_on']).weekday()==5 for e in generated['events']))
