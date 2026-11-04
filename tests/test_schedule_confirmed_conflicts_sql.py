"""009 em PostgreSQL isolado: rascunhos, publicação concorrente e referências históricas."""
import json
import subprocess
import unittest
import uuid
import test_schedule_monthly_sql as monthly
import test_user_management_sql as base
D,E=monthly.D,monthly.E

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class ConfirmedScheduleSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    call=monthly.MonthlyScheduleSQLTests.call
    catalog=monthly.MonthlyScheduleSQLTests.catalog
    person=monthly.MonthlyScheduleSQLTests.person
    grant=monthly.MonthlyScheduleSQLTests.grant
    rpc=monthly.MonthlyScheduleSQLTests.rpc
    event=monthly.MonthlyScheduleSQLTests.event
    requirements=monthly.MonthlyScheduleSQLTests.requirements
    save=monthly.MonthlyScheduleSQLTests.save
    profile=monthly.MonthlyScheduleSQLTests.profile
    daily_event=monthly.MonthlyScheduleSQLTests.daily_event
    plan=monthly.MonthlyScheduleSQLTests.plan
    context=monthly.MonthlyScheduleSQLTests.context
    def setUp(self):
        monthly.MonthlyScheduleSQLTests.setUp(self)
        self.sql((base.ROOT/'database/009_confirmed_schedule_conflicts.sql').read_text())
    def publish(self,plan,**kwargs):return self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())],**kwargs)
    def legacy(self,dept=D,day='2031-01-01',key='manual-source-1',**kwargs):
        row=dict(source_key=key,person_id=self.p['id'],department_id=dept,date=day,original_name='Nome histórico preservado')
        return self.rpc('iasdpi_schedule_register_legacy',[json.dumps([row]),str(uuid.uuid4())],**kwargs)
    def test_installation_preserves_existing_assignments_and_people(self):
        self.assertEqual(self.sql("select jsonb_agg(jsonb_build_object('id',id,'starts',starts_at,'ends',ends_at,'person',person_id) order by id) from public.schedule_assignments"),self.before)
        self.assertEqual(self.sql('select count(*) from public.schedule_legacy_commitments'),'0')
        self.assertEqual(self.sql('select count(*) from public.schedule_people'),'1')
    def test_other_draft_warns_but_is_not_confirmed_commitment(self):
        self.profile();e=self.daily_event();self.plan(e);self.plan(e,E)
        detail=self.context()['people'][0]['days'][0];self.assertFalse(detail['conflict']);self.assertTrue(detail['draft_dispute']);self.assertEqual(self.context()['people'][0]['global_days'],[])
        approval=self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,dict(person_id=self.p['id'],day='2031-01-01',department_a=D,department_b=E,reason='Autorização fictícia para teste.')])
        revoked=self.rpc('iasdpi_schedule_exception_save',[approval['id'],1,{'enabled':False}]);self.assertFalse(revoked['enabled'])
    def test_publication_revalidates_even_when_only_status_is_sent(self):
        self.profile();e=self.daily_event();one=self.plan(e);two=self.plan(e,E);self.publish(one);self.publish(two,fail=True)
        self.assertEqual(self.sql("select status from public.schedule_plans where id='%s'"%two['id']),'draft')
        self.assertEqual(self.sql("select count(*) from public.schedule_versions where plan_id='%s'"%two['id']),'1')
        self.assertTrue(self.context(E)['people'][0]['days'][0]['conflict'])
    def test_new_draft_cannot_ignore_published_other_department(self):
        self.profile();e=self.daily_event();one=self.plan(e,E);self.publish(one);self.plan(e,fail=True)
    def test_concurrent_publications_only_one_commits(self):
        self.profile();e=self.daily_event();plans=[self.plan(e),self.plan(e,E)];processes=[]
        for p in plans:
            query="select public.iasdpi_schedule_plan_save('%s',1,'{\"status\":\"published\"}','%s');"%(p['id'],uuid.uuid4())
            processes.append(subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env))
            processes[-1].stdin.write(self.command(query,actor=base.A));processes[-1].stdin.close();processes[-1].stdin=None
        results=[p.communicate(timeout=30) for p in processes]
        self.assertEqual(sum(p.returncode==0 for p in processes),1,results)
        self.assertEqual(self.sql("select count(*) from public.schedule_plans where status='published'"),'1')
    def test_other_draft_does_not_consume_confirmed_quota_but_publish_does(self):
        self.profile(max_monthly_count=1);one=self.plan(self.daily_event());two=self.plan(self.daily_event('2031-01-02'),E)
        self.publish(one);self.publish(two,fail=True)
        self.assertEqual(self.context(E)['people'][0]['global_days'],['2031-01-01'])
    def test_manual_history_requires_explicit_mapping_and_never_creates_people(self):
        first=self.legacy();second=self.legacy();self.assertEqual(first['inserted'],1);self.assertEqual(second['inserted'],0)
        self.assertEqual(self.sql('select count(*) from public.schedule_people'),'1')
        self.assertEqual(self.sql('select count(*) from public.schedule_qualifications'),'2')
        self.assertEqual(self.context()['people'][0]['global_days'],['2031-01-01'])
        self.legacy(day='2031-01-02',fail=True)
        history=self.rpc('iasdpi_schedule_person_history',[self.p['id']]);self.assertTrue(any(r.get('original_name')=='Nome histórico preservado' for r in history['current']))
    def test_draft_semantics_do_not_bypass_unknown_or_qualification_or_zero_limit(self):
        e=self.daily_event();self.plan(e,fail=True);self.profile(max_monthly_count=0);self.plan(e,fail=True)
        self.profile(max_monthly_count=None);m=next(m for m in self.catalog()['memberships'] if m['department_id']==D)
        self.call('membership',{'role_ids':[]},id=m['id'],version=m['version']);self.plan(e,fail=True)
    def test_import_permissions_and_direct_writes_blocked(self):
        self.grant();self.legacy(actor=base.L,fail=True)
        self.sql("select public.iasdpi_schedule_register_legacy('[]',gen_random_uuid())",anonymous=True,fail=True)
        for sql in ['select * from public.schedule_legacy_commitments','delete from public.schedule_legacy_commitments','select * from iasdpi_schedule_private.confirmed_days']:
            self.sql(sql,actor=base.A,fail=True)
    def test_manual_history_blocks_other_department_before_save(self):
        self.legacy();self.profile();self.plan(self.daily_event(),E,fail=True)
        context=self.context(E);self.assertTrue(context['people'][0]['days'][0]['conflict']);self.assertEqual(context['people'][0]['global_days'],['2031-01-01'])
    def test_legacy_exception_cannot_be_revoked_while_in_use(self):
        self.legacy();self.profile();approval=self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,dict(person_id=self.p['id'],day='2031-01-01',department_a=D,department_b=E,reason='Autorização fictícia para teste.')]);self.publish(self.plan(self.daily_event(),E))
        self.rpc('iasdpi_schedule_exception_save',[approval['id'],1,{'enabled':False}],fail=True)
        self.assertEqual(self.sql('select enabled from public.schedule_day_exceptions'),'t')
    def test_new_functions_are_owned_by_postgres_and_private_helpers_denied(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_confirmed_schedule_conflicts.sql').read_text()),'')
        self.assertEqual(self.sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'iasdpi_schedule_%' and (p.proowner<>'postgres'::regrole or not p.prosecdef or not ('search_path=\"\"'=any(p.proconfig)) or has_function_privilege('anon',p.oid,'execute'))"),'0')
        self.sql("select iasdpi_schedule_private.monthly_days(null,'2031-01-01',false)",actor=base.A,fail=True)
