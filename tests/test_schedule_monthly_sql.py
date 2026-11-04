"""B1.2: migração/contexto reais em PostgreSQL descartável, sem produção."""
import json
import unittest
import uuid
import test_schedule_daily_sql as daily
import test_user_management_sql as base
D,E=daily.D,daily.E

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL isolado sem rede')
class MonthlyScheduleSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    call=daily.DailyScheduleSQLTests.call
    catalog=daily.DailyScheduleSQLTests.catalog
    person=daily.DailyScheduleSQLTests.person
    grant=daily.DailyScheduleSQLTests.grant
    rpc=daily.DailyScheduleSQLTests.rpc
    event=daily.DailyScheduleSQLTests.event
    requirements=daily.DailyScheduleSQLTests.requirements
    save=daily.DailyScheduleSQLTests.save
    profile=daily.DailyScheduleSQLTests.profile
    daily_event=daily.DailyScheduleSQLTests.daily_event
    plan=daily.DailyScheduleSQLTests.plan
    def setUp(self):
        daily.DailyScheduleSQLTests.setUp(self)
        self.sql((base.ROOT/'database/008_monthly_rotation.sql').read_text())
    def context(self,dept=D,month='2031-01-01',actor=base.A,fail=False):return self.rpc('iasdpi_schedule_rotation_context',[dept,month],actor,fail)
    def test_008_preserves_ids_times_and_existing_plans(self):
        self.assertEqual(self.sql("select jsonb_agg(jsonb_build_object('id',id,'starts',starts_at,'ends',ends_at,'person',person_id) order by id) from public.schedule_assignments"),self.before)
        self.assertEqual(self.sql('select count(*) from public.schedule_plans'),'2')
        self.assertEqual(self.sql('select count(*) from public.schedule_people'),'1')
    def test_unknown_and_explicit_availability_context(self):
        rows=self.context()['people'][0]['days'];self.assertTrue(all(d['state']=='unknown' for d in rows))
        self.profile();rows=self.context()['people'][0]['days'];self.assertTrue(all(d['state']=='available' for d in rows))
        self.assertEqual(len(rows),31)
    def test_cross_department_conflict_context_does_not_expose_other_roster(self):
        self.profile();e=self.daily_event();self.plan(e,E);self.grant(dept=D)
        context=self.context(actor=base.L);person=context['people'][0]
        self.assertTrue(next(d for d in person['days'] if d['date']=='2031-01-01')['conflict'])
        self.assertEqual(person['global_days'],['2031-01-01']);self.assertEqual(person['department_days'],[])
        self.assertNotIn(E,json.dumps(context));self.assertNotIn('assignments',context)
        self.context(E,actor=base.L,fail=True)
    def test_admin_exception_clears_warning_not_availability(self):
        self.profile();e=self.daily_event();self.plan(e,E)
        self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,dict(person_id=self.p['id'],day='2031-01-01',department_a=D,department_b=E,reason='Autorização fictícia para teste.')])
        self.assertFalse(self.context()['people'][0]['days'][0]['conflict'])
    def test_current_plan_excluded_for_proposal_quotas_and_save_reopen_same_id(self):
        self.profile(max_monthly_count=1);e=self.daily_event();plan=self.plan(e)
        self.assertEqual(self.context()['people'][0]['global_days'],[])
        workspace=self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01']);self.assertTrue(workspace['monthly']);self.assertEqual(workspace['plan']['id'],plan['id'])
        self.assertEqual(workspace['rotation_context']['basis_version'],1)
        updated=self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Título revisado'},str(uuid.uuid4())]);self.assertEqual(updated['version'],2)
        self.assertEqual(self.context()['basis_version'],2);self.assertEqual(self.sql("select count(*) from public.schedule_plans where month='2031-01-01'"),'1')
    def test_published_history_only_and_ministry_head_from_memberships(self):
        self.assertEqual(self.context()['people'][0]['history_count'],0)
        self.rpc('iasdpi_schedule_plan_save',[self.old['id'],1,{'status':'published'},str(uuid.uuid4())])
        context=self.context();self.assertEqual(context['people'][0]['history_count'],1);self.assertEqual(context['people'][0]['last_day'],'2026-10-10');self.assertEqual(context['heads'],[])
        member=next(m for m in self.catalog()['memberships'] if m['department_id']==D)
        self.call('membership',{'is_ministry_head':True},id=member['id'],version=member['version'])
        self.assertEqual(self.context()['heads'],[self.p['display_name']])
    def test_permissions_viewer_anonymous_and_private_helper(self):
        self.grant(level='viewer')
        self.context(actor=base.L,fail=True)
        workspace=self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01'],actor=base.L);self.assertTrue(workspace['monthly']);self.assertIsNone(workspace['rotation_context'])
        self.sql("select public.iasdpi_schedule_rotation_context('%s','2031-01-01')"%D,anonymous=True,fail=True)
        self.sql("select iasdpi_schedule_private.workspace_007('%s','2031-01-01')"%D,actor=base.A,fail=True)
        self.context(actor=base.U,fail=True)
    def test_security_definer_owner_empty_path_and_no_anon_execute(self):
        self.assertEqual(self.sql("select count(*) from pg_proc p where p.oid='public.iasdpi_schedule_rotation_context(uuid,date)'::regprocedure and p.proowner='postgres'::regrole and p.prosecdef and 'search_path=\"\"'=any(p.proconfig) and not has_function_privilege('anon',p.oid,'execute') and has_function_privilege('authenticated',p.oid,'execute')"),'1')
        self.context(month='2031-01-02',fail=True)
        self.context(month=None,fail=True)
    def test_read_context_has_no_mutation_and_concurrent_stale_save_remains_blocked(self):
        self.profile();e=self.daily_event();plan=self.plan(e);before=self.sql('select count(*) from public.schedule_versions')
        for _ in range(2):self.context()
        self.assertEqual(self.sql('select count(*) from public.schedule_versions'),before)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Outra gravação'},str(uuid.uuid4())])
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Versão antiga'},str(uuid.uuid4())],fail=True)
        self.assertEqual(self.context()['basis_version'],2)
    def test_readonly_check_and_down_preserve_data_and_old_interface(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_monthly_rotation.sql').read_text()),'')
        self.sql((base.ROOT/'database/008_monthly_rotation_down.sql').read_text())
        workspace=self.rpc('iasdpi_schedule_workspace',[D,'2026-10-01'])
        self.assertNotIn('monthly',workspace);self.assertEqual(workspace['plan']['id'],self.old['id'])
        self.assertEqual(self.sql('select count(*) from public.schedule_assignments'),'2')
