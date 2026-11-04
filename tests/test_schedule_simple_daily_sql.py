"""010 em PostgreSQL sem rede, contas e bancos descartáveis; nunca Supabase."""
import json
import subprocess
import unittest
import uuid
import test_schedule_confirmed_conflicts_sql as previous
import test_user_management_sql as base
D,E=previous.D,previous.E

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class SimpleDailySQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    call=previous.ConfirmedScheduleSQLTests.call
    catalog=previous.ConfirmedScheduleSQLTests.catalog
    person=previous.ConfirmedScheduleSQLTests.person
    grant=previous.ConfirmedScheduleSQLTests.grant
    rpc=previous.ConfirmedScheduleSQLTests.rpc
    event=previous.ConfirmedScheduleSQLTests.event
    requirements=previous.ConfirmedScheduleSQLTests.requirements
    save=previous.ConfirmedScheduleSQLTests.save
    profile=previous.ConfirmedScheduleSQLTests.profile
    daily_event=previous.ConfirmedScheduleSQLTests.daily_event
    plan=previous.ConfirmedScheduleSQLTests.plan
    context=previous.ConfirmedScheduleSQLTests.context
    publish=previous.ConfirmedScheduleSQLTests.publish
    def setUp(self):
        previous.ConfirmedScheduleSQLTests.setUp(self)
        self.sql((base.ROOT/'database/010_simple_daily_schedules.sql').read_text())
    def general_role(self,dept=D,**kwargs):return self.rpc('iasdpi_schedule_daily_role',[dept],**kwargs)
    def general_plan(self,event,dept=D,**kwargs):
        role=self.general_role(dept);rows=self.requirements(event,dept);rows[0]['role_id']=role['id']
        return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,dict(department_id=dept,month=event['scheduled_on'][:7]+'-01',title='Escala diária',requirements=rows),str(uuid.uuid4())],**kwargs)
    def test_migration_preserves_people_legacy_values_and_previous_settings(self):
        self.assertEqual(self.sql("select jsonb_agg(jsonb_build_object('id',id,'starts',starts_at,'ends',ends_at,'person',person_id) order by id) from public.schedule_assignments"),self.before)
        self.assertEqual(self.sql('select count(*) from public.schedule_people'),'1')
        self.assertEqual(self.sql('select count(*) from public.schedule_roles where general_assignment'),'0')
        self.assertEqual(self.sql('select count(*) from public.schedule_availability'),'0')
        settings=self.rpc('iasdpi_schedule_settings_get',[]);self.assertTrue(settings['simplified_daily']);self.assertTrue(settings['availability_advisory']);self.assertEqual(settings['availability_default'],'available');self.assertEqual(settings['planning_months'],2)
        self.assertTrue(all(d['state']=='available' for d in self.context()['people'][0]['days']))
    def test_general_role_idempotent_no_new_people_or_technical_qualifications(self):
        first=self.general_role();self.assertEqual(first['id'],self.general_role()['id']);self.assertTrue(first['general_assignment'])
        self.assertEqual(self.sql('select count(*) from public.schedule_qualifications'),'2')
        member=next(m for m in self.catalog()['memberships'] if m['department_id']==D)
        self.call('membership',dict(role_ids=[]),id=member['id'],version=member['version'])
        self.general_plan(self.daily_event());self.plan(self.daily_event('2031-02-01'),fail=True)
    def test_manual_restriction_and_zero_quota_are_advisory_and_audited_once(self):
        self.profile(weekdays={'3':'unavailable'},max_monthly_count=0)
        detail=self.context()['people'][0]['days'][0];self.assertEqual(detail['state'],'unavailable')
        plan=self.general_plan(self.daily_event());self.assertEqual(plan['version'],1)
        published=self.publish(plan);self.assertEqual(published['status'],'published')
        request=str(uuid.uuid4());args=[plan['id'],2,{'title':'Mesmo culto, revisão'},request]
        one=self.rpc('iasdpi_schedule_plan_save',args);two=self.rpc('iasdpi_schedule_plan_save',args);self.assertEqual(one,two)
        self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='manual-preference-override' and entity_id='%s'"%request),'1')
        self.assertEqual(self.context()['people'][0]['days'][0]['state'],'unavailable')
    def test_concurrent_publication_cannot_ignore_cross_department_conflict(self):
        e=self.daily_event();plans=[self.general_plan(e),self.general_plan(e,E)];processes=[]
        for p in plans:
            query="select public.iasdpi_schedule_plan_save('%s',1,'{\"status\":\"published\"}','%s');"%(p['id'],uuid.uuid4())
            process=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);process.stdin.write(self.command(query,actor=base.A));process.stdin.close();process.stdin=None;processes.append(process)
        results=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,results)
        self.assertEqual(self.sql("select count(*) from public.schedule_plans where status='published' and month='2031-01-01'"),'1')
    def test_stale_version_and_partial_update_preserve_assignments(self):
        plan=self.general_plan(self.daily_event());revised=self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Revisada'},str(uuid.uuid4())])
        self.assertEqual(revised['requirements'],plan['requirements'])
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Antiga'},str(uuid.uuid4())],fail=True)
        self.assertEqual(self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01'])['plan']['version'],2)
    def test_manager_scope_anon_and_direct_writes_remain_protected(self):
        self.rpc('iasdpi_schedule_daily_role',[D],base.L,True);self.grant();self.general_role(actor=base.L);self.general_role(E,actor=base.L,fail=True)
        self.sql("select public.iasdpi_schedule_daily_role('%s')"%D,anonymous=True,fail=True)
        for source in ["update public.schedule_roles set general_assignment=true", "select iasdpi_schedule_private.day_availability_009(null,null,null)", 'select iasdpi_schedule_private.settings_get_009()']:
            self.sql(source,actor=base.A,fail=True)
        self.call('role',{'department_id':D,'name':'Forjada','general_assignment':True},fail=True)
        self.assertEqual(self.sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'iasdpi_schedule_%' and (p.proowner<>'postgres'::regrole or not p.prosecdef or not ('search_path=\"\"'=any(p.proconfig)) or has_function_privilege('anon',p.oid,'execute'))"),'0')
