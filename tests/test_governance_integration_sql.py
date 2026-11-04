"""G6: auditoria da cadeia completa 001–015 em PostgreSQL sem rede."""
import json
import subprocess
import unittest
import uuid
import test_elder_storage_sql as g5
import test_user_management_sql as base
import test_church_isolation_sql as g1
import test_alias_login_sql as g2
D=g1.D;M='a0000000-0000-4000-8000-000000000003';E=g5.D
ELDER='88888888-8888-4888-8888-888888888888'
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class GovernanceIntegrationSQLTests(unittest.TestCase):
    setUpClass=classmethod(g5.ElderStorageSQLTests.setUpClass.__func__)
    setUp=g5.ElderStorageSQLTests.setUp
    sql=g5.ElderStorageSQLTests.sql
    command=g5.ElderStorageSQLTests.command
    rpc=g5.ElderStorageSQLTests.rpc
    quote=staticmethod(g5.ElderStorageSQLTests.quote)
    grant=g5.ElderStorageSQLTests.grant
    service=g2.AliasLoginSQLTests.service
    def setup_profiles(self):
        self.sql("insert into auth.users values('%s','elder@g6.invalid',now(),false)"%ELDER)
        self.rpc('iasdpi_set_access',[base.B,'admin',True])
        for user,departments in [(base.L,[D]),(base.V,[M]),(ELDER,[E]),(base.U,[D,M])]:
            for d in departments:self.grant(user=user,dept=d,flags={'view':True,'edit':True,'publish':True,'members':True})
        for alias,user in [('administrador',base.A),('admin.pi',base.B),('sonoplastia',base.L),('musica',base.V),('anciaos',ELDER),('multi.g6',base.U)]:
            old=next((a for a in self.rpc('iasdpi_alias_list',[]) if a['identifier']==alias),None)
            self.rpc('iasdpi_alias_save',[alias,user,True,old['version'] if old else 0,'Vínculo exclusivamente descartável da G6'])
    def create(self,entity,data,id=None,version=0,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_save',[entity,id or str(uuid.uuid4()),version,data,str(uuid.uuid4())],actor,fail)
    def person(self,name='Participante G6',department=D):return self.create('person',{'name':name,'display_name':name,'department_id':department})
    def plan(self,department,people,day='2031-01-01'):
        role=self.rpc('iasdpi_schedule_daily_role',[department]);event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':department,'title':'Culto G6','date':day},str(uuid.uuid4())])
        return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':department,'month':day[:7]+'-01','title':'Escala G6','requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':max(1,len(people)),'notes':'NOTA PRIVADA G6','assignments':[{'id':str(uuid.uuid4()),'person_id':p} for p in people]}]},str(uuid.uuid4())])
    def publish(self,plan,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())],actor,fail)
    def test_all_profiles_scope_aliases_and_anonymous(self):
        self.setup_profiles()
        for alias,user,allowed in [('administrador',base.A,{D,M,E,'a0000000-0000-4000-8000-000000000002'}),('admin.pi',base.B,{D,M,E,'a0000000-0000-4000-8000-000000000002'}),('sonoplastia',base.L,{D}),('musica',base.V,{M}),('anciaos',ELDER,{E}),('multi.g6',base.U,{D,M})]:
            self.assertEqual(self.service('iasdpi_alias_login_lookup',[alias])['user_id'],user)
            ctx=self.rpc('iasdpi_portal_context',[],user);self.assertEqual({d['id'] for d in ctx['departments']},allowed)
            for d in {D,M,E}-allowed:self.rpc('iasdpi_schedule_workspace',[d,'2031-01-01'],user,True)
        self.sql('select public.iasdpi_portal_context()',anonymous=True,fail=True)
        self.assertEqual(json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True)),[])
    def test_single_person_multi_department_music_team_publication_history(self):
        self.setup_profiles();p=self.person();q=self.person('Outro participante G6',M)
        self.create('membership',{'person_id':p['id'],'department_id':M,'active':True,'role_ids':[]})
        self.assertEqual(self.sql("select count(*) from public.schedule_people where id='%s'"%p['id']),'1')
        self.create('person',{'name':'  PARTICIPANTE G6  ','display_name':'duplicado','department_id':M},fail=True)
        plan=self.plan(M,[p['id'],q['id']]);published=self.publish(plan,base.V)
        rows=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(len(rows),2);self.assertNotIn('NOTA PRIVADA',json.dumps(rows))
        revised=self.rpc('iasdpi_schedule_plan_save',[plan['id'],published['version'],{'status':'draft','title':'Revisão privada'},str(uuid.uuid4())],base.V)
        self.assertEqual(rows,json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True)))
        self.assertEqual(len(self.rpc('iasdpi_schedule_plan_version',[plan['id'],1],base.V)['requirements'][0]['assignments']),2)
        self.publish(revised,base.V);self.assertEqual(self.sql("select count(*) from public.schedule_versions where plan_id='%s'"%plan['id']),'4')
    def test_weekday_preferences_manual_override_and_backend_conflicts(self):
        p=self.person();self.rpc('iasdpi_schedule_member_save',[p['id'],p['version'],{'name':p['name'],'display_name':p['display_name'],'active':True,'weekdays':{'3':'unavailable'},'unavailable_dates':[],'max_monthly_count':0},str(uuid.uuid4())])
        ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertEqual(ctx['people'][0]['days'][0]['state'],'unavailable')
        plan=self.publish(self.plan(D,[p['id']]))
        self.create('membership',{'person_id':p['id'],'department_id':M,'active':True,'role_ids':[]})
        blocked=self.rpc('iasdpi_schedule_rotation_context',[M,'2031-01-01']);self.assertTrue(blocked['people'][0]['days'][0]['conflict'])
        self.assertGreater(int(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='manual-preference-override'")),0)
        with self.assertRaisesRegex(AssertionError,'Conflito'):self.plan(M,[p['id']])
        self.assertEqual(plan['status'],'published')
    def test_admin_scope_and_cross_church_no_unrestricted_superuser(self):
        self.setup_profiles();self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','G6_ONLY','Igreja apenas no teste descartável',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.A))
        self.assertEqual(len(self.rpc('iasdpi_my_churches',[],base.A)),2);self.assertEqual(len(self.rpc('iasdpi_my_churches',[],base.B)),1)
        self.church='G6_ONLY';self.rpc('iasdpi_portal_context',[],base.B,True);self.rpc('iasdpi_schedule_daily_role',[D],base.A,True)
        self.church='IASD_PI';self.assertTrue(self.rpc('iasdpi_portal_context',[],base.B)['is_admin'])
    def test_ministerial_revocation_blocks_write_and_preserves_separate_chrono_identity(self):
        self.setup_profiles();p=self.person();plan=self.plan(D,[p['id']]);self.grant(user=base.L,status='revoked',version=1)
        self.publish(plan,base.L,True);self.assertEqual(self.service('iasdpi_alias_login_lookup',['sonoplastia'])['user_id'],base.L)
        self.rpc('iasdpi_set_access',[base.L,'leader',False]);self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']))
        self.assertEqual(self.sql("select status from public.schedule_plans where id='%s'"%plan['id']),'draft')
    def test_combined_postinstall_catalogue_security(self):
        for name in ['check_church_isolation.sql','check_alias_login.sql','check_access_governance.sql','check_portal_integration.sql','check_elder_period_storage.sql','check_governance_integration.sql']:
            self.assertEqual(self.sql((base.ROOT/'database'/name).read_text()),'',name)
    def test_audit_confirms_old_stage_checkers_are_not_post_g1_compatible(self):
        result=self.sql((base.ROOT/'database/check_schedule_management.sql').read_text())
        self.assertIn('rpc:iasdpi_schedule_workspace',result)
        self.assertEqual(self.sql("select pg_get_userbyid(proowner) from pg_proc where oid='public.iasdpi_schedule_workspace(uuid,date)'::regprocedure"),'iasdpi_church_executor')
    def test_audit_department_weekdays_not_persisted_in_current_schema(self):
        d=self.create('department',{'code':'comunicacao','name':'Comunicação'})
        settings=self.rpc('iasdpi_schedule_settings_get',[]);self.assertNotIn('department_weekdays',settings)
        e=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':d['id'],'title':'Quarta sem restrição ministerial','date':'2031-01-01'},str(uuid.uuid4())])
        self.assertEqual(e['scheduled_on'],'2031-01-01')
    def test_audit_rotation_retains_self_published_days_during_draft_revision(self):
        # Observação de uma limitação: o booleano de conflito não bloqueia,
        # mas a carga mensal continua contando a própria publicação anterior.
        p=self.person();plan=self.publish(self.plan(D,[p['id']]))
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'draft','requirements':[]},str(uuid.uuid4())])
        ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertIn('2031-01-01',ctx['people'][0]['global_days'])

    def test_readiness_markers_and_catalogue_evidence(self):
        raw=self.sql((base.ROOT/'database/check_governance_readiness.sql').read_text());self.assertEqual(raw.count('Presente:'),11)
        query="""select jsonb_build_object(
        'tables',(select jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'rls',c.relrowsecurity,'owner',pg_get_userbyid(c.relowner))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='public' and c.relname like 'schedule_%' or n.nspname in ('iasdpi_schedule_private','iasdpi_governance_private'))),
        'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('iasdpi_schedule_private','iasdpi_admin_private','iasdpi_governance_private') or n.nspname='public' and p.proname like 'iasdpi_%'),
        'indexes',(select jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef)) from pg_indexes where schemaname='public' and tablename like 'schedule_%'),
        'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public' and tablename like 'schedule_%'))"""
        result=json.loads(self.sql(query));target=base.ROOT/'dist'/getattr(self,'artifact_folder','governance-g6')/'catalogue-evidence.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
        self.assertTrue(all(t['rls'] for t in result['tables']))
    def test_audit_old_008_rollback_not_suitable_after_015(self):
        before=self.sql('select count(*) from public.schedule_elder_periods');self.sql((base.ROOT/'database/008_monthly_rotation_down.sql').read_text(),fail=True)
        self.assertEqual(before,self.sql('select count(*) from public.schedule_elder_periods'))
        self.assertEqual(self.sql("select to_regprocedure('public.iasdpi_schedule_rotation_context(uuid,date)') is not null"),'t')
        # G7: reversão antiga recusa dependências posteriores, sem mutação parcial.
