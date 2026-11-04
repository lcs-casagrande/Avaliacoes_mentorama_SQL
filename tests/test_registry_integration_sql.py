"""G8.2: banco real descartável, sem rede nem Supabase."""
import json,subprocess,unittest,uuid
import test_department_days_sql as g7
import test_user_management_sql as base
import test_church_isolation_sql as g1
D=g7.D;M=g7.M;E='a0000000-0000-4000-8000-000000000004'

class RegistryMixin(g7.LatestSchemaMixin):
    @classmethod
    def setUpClass(cls):
        super().setUpClass();p=cls('runTest');p.sql((base.ROOT/'database/017_central_registry_integration.sql').read_text(),database=cls.template16)

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class RegistryIntegrationSQLTests(RegistryMixin,unittest.TestCase):
    def save(self,person,links=None,patch=None,version=None,actor=base.A,fail=False,request=None):
        if version is None:version=int(self.sql("select coalesce((select version from public.schedule_people where id='%s'),0)"%person))
        return self.rpc('iasdpi_registry_save',[person,version,patch or {},links or [],request or str(uuid.uuid4())],actor,fail)
    def person(self):
        p=str(uuid.uuid4());self.save(p,patch={'name':'Pessoa de teste '+p[:8]});return p
    def link(self,person,dept=D,patch=None,version=0,actor=base.A,fail=False):return self.save(person,[{'department_id':dept,'expected_version':version,'patch':patch or {}}],actor=actor,fail=fail)
    def member(self,p,d=D):return next(x for x in self.rpc('iasdpi_schedule_catalog',[])['memberships'] if x['person_id']==p and x['department_id']==d)
    def role(self,d=D):return self.rpc('iasdpi_schedule_save',['role',str(uuid.uuid4()),0,{'department_id':d,'name':'Função '+str(uuid.uuid4())[:8]},str(uuid.uuid4())])['id']
    def days(self,state='unknown'):return {str(i):state for i in range(7)}
    def test_three_departments_one_person_and_independent_roles(self):
        p=self.person();roles=[self.role(d) for d in [D,M,E]]
        links=[{'department_id':d,'expected_version':0,'patch':{'role_ids':[r],'participation_confirmed':True,'is_ministry_head':d==D,'weekdays':self.days('available'),'max_monthly_count':i+1}} for i,(d,r) in enumerate(zip([D,M,E],roles))]
        self.save(p,links);before=self.member(p,M);self.link(p,patch={'max_monthly_count':4},version=1)
        self.assertEqual(self.member(p,M),before);self.assertEqual(self.sql("select count(*) from public.schedule_people where id='%s'"%p),'1');self.assertEqual(self.sql("select count(*) from public.schedule_memberships where person_id='%s'"%p),'3');self.assertEqual(self.member(p)['max_monthly_count'],4)
    def test_unknown_never_becomes_available_and_department_override_isolated(self):
        p=self.person();self.link(p);self.link(p,M);ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertEqual(next(x for x in ctx['people'] if x['person_id']==p)['days'][0]['state'],'unknown')
        self.link(p,patch={'weekdays':self.days('available')},version=1);ctx=self.rpc('iasdpi_schedule_rotation_context',[M,'2031-01-01']);self.assertEqual(next(x for x in ctx['people'] if x['person_id']==p)['days'][0]['state'],'unknown')
        self.link(p,patch={'weekdays':self.days()},version=2);ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertTrue(all(x['state']=='unknown' for x in next(x for x in ctx['people'] if x['person_id']==p)['days']))
    def test_authorized_link_to_existing_person_and_atomic_scope_denial(self):
        p=self.person();self.grant(flags={'view':True,'members':True});self.assertIn(p,[x['id'] for x in self.rpc('iasdpi_registry_people',[''],base.U)])
        self.link(p,actor=base.U);self.link(p,M,actor=base.U,fail=True);self.save(p,patch={'name':'Renomeação indevida'},actor=base.U,fail=True)
        self.save(p,[{'department_id':D,'expected_version':1,'patch':{'max_monthly_count':3}},{'department_id':M,'expected_version':0,'patch':{}}],actor=base.U,fail=True);self.assertIsNone(self.member(p)['max_monthly_count'])
    def test_leader_is_not_qualified_and_roles_cannot_cross_departments(self):
        p=self.person();self.link(p,patch={'is_ministry_head':True});m=self.member(p);self.assertFalse(m['participation_confirmed']);self.assertEqual(self.sql("select count(*) from public.schedule_qualifications where membership_id='%s'"%m['id']),'0')
        self.link(p,patch={'role_ids':[self.role(M)]},version=1,fail=True);self.assertEqual(self.member(p)['version'],1)
    def test_rename_preserves_id_and_public_leadership_uses_current_name(self):
        p=self.person();self.link(p,patch={'is_ministry_head':True});self.save(p,patch={'name':'Nome atualizado de teste'});heads=self.sql("select public.iasdpi_registry_public()",anonymous=True);self.assertIn('Nome atualizado de teste',heads);self.assertEqual(self.member(p)['person_id'],p)
    def test_source_links_explicit_versioned_and_private_fields_not_public(self):
        p=self.person();self.rpc('iasdpi_registry_source_save',['legacy:teste',p,0,str(uuid.uuid4())]);self.rpc('iasdpi_registry_source_save',['legacy:teste',p,0,str(uuid.uuid4())],fail=True)
        self.save(p,patch={'name':'Nome atual'});public=json.loads(self.sql('select public.iasdpi_registry_public()',anonymous=True));self.assertEqual(public['links'],[{'source_key':'legacy:teste','display_name':'Nome atual'}]);self.assertNotIn('person_id',json.dumps(public));self.rpc('iasdpi_registry_source_save',['legacy:outro',p,0,str(uuid.uuid4())],base.U,True)
    def test_stale_link_and_idempotent_retry(self):
        p=self.person();rid=str(uuid.uuid4());links=[{'department_id':D,'expected_version':0,'patch':{'max_monthly_count':3}}];r=self.save(p,links,request=rid);self.assertEqual(r,self.save(p,links,request=rid));self.link(p,version=0,fail=True);self.assertEqual(self.member(p)['version'],1)
    def test_direct_tables_anon_and_cross_church_rejected(self):
        p=self.person();self.link(p);self.sql('select * from public.schedule_source_links',anonymous=True,fail=True);self.sql('select public.iasdpi_registry_catalog()',anonymous=True,fail=True);self.sql('update public.schedule_memberships set participation_confirmed=true',actor=base.A,fail=True)
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','OTHER','Igreja fictícia',true,true)"%g1.OTHER);self.church='OTHER';self.link(p,version=1,fail=True);self.assertEqual(json.loads(self.sql('select public.iasdpi_registry_public()',anonymous=True)),{'heads':[],'links':[],'configured':[]})
    def test_actual_concurrent_membership_edit_has_one_winner(self):
        p=self.person();self.link(p);processes=[]
        for maximum in [3,4]:
            rows=[{'department_id':D,'expected_version':1,'patch':{'max_monthly_count':maximum}}]
            query="select public.iasdpi_registry_save('%s',1,'{}',%s::jsonb,'%s')"%(p,self.quote(json.dumps(rows)),uuid.uuid4())
            process=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);process.stdin.write(self.command(query,base.A));process.stdin.close();process.stdin=None;processes.append(process)
        outputs=[x.communicate(timeout=30) for x in processes];self.assertEqual(sum(x.returncode==0 for x in processes),1,outputs);self.assertEqual(self.member(p)['version'],2)
    def test_rename_does_not_mutate_plan_versions_and_scoped_history(self):
        import test_elder_storage_sql as g5
        p=g5.ElderStorageSQLTests.person(self);plan=g5.ElderStorageSQLTests.daily(self,p)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())]);before=self.sql("select md5(jsonb_agg(to_jsonb(v))::text) from public.schedule_versions v")
        self.save(p,patch={'name':'Nome novo preserva ID'});after=self.sql("select md5(jsonb_agg(to_jsonb(v))::text) from public.schedule_versions v");self.assertEqual(before,after)
        self.grant(flags={'view':True,'members':True});history=self.rpc('iasdpi_registry_history',[p,D],base.U);self.assertEqual(len(history['current']),1);self.rpc('iasdpi_registry_history',[p,E],base.U,True)
        feed=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertIn('Nome novo preserva ID',[r['person'] for r in feed])
    def test_independent_department_edits_keep_all_other_data_and_prevent_duplicates(self):
        p=self.person();self.link(p);self.link(p,M);before=self.member(p,M)
        self.link(p,patch={'max_monthly_count':2},version=1);self.assertEqual(before,self.member(p,M));self.save(str(uuid.uuid4()),patch={'name':self.rpc('iasdpi_registry_people',[''])[0]['name']},fail=True)
    def test_global_unavailability_wins_and_unknown_department_does_not_inherit_available(self):
        p=self.person();self.link(p);self.rpc('iasdpi_schedule_save',['availability',str(uuid.uuid4()),0,{'person_id':p,'kind':'available','pattern':'weekly','weekdays':[0,1,2,3,4,5,6]},str(uuid.uuid4())])
        self.link(p,patch={'weekdays':self.days()},version=1);ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertEqual(next(x for x in ctx['people'] if x['person_id']==p)['days'][0]['state'],'unknown')
        self.link(p,patch={'weekdays':self.days('available')},version=2);self.rpc('iasdpi_schedule_save',['availability',str(uuid.uuid4()),0,{'person_id':p,'kind':'unavailable','pattern':'period','starts_on':'2031-01-01','ends_on':'2031-01-01'},str(uuid.uuid4())])
        ctx=self.rpc('iasdpi_schedule_rotation_context',[D,'2031-01-01']);self.assertEqual(next(x for x in ctx['people'] if x['person_id']==p)['days'][0]['state'],'unavailable')
    def test_reconciliation_registers_historical_commitments_by_unique_id(self):
        p=self.person();self.link(p);self.link(p,M);ref={'department_id':D,'starts_on':'2031-01-01','ends_on':'2031-01-01','kind':'daily','original_name':'Nome histórico intacto'};req=str(uuid.uuid4())
        args=['legacy:fonte-datada',p,0,req,ref];a=self.rpc('iasdpi_registry_source_save',args);self.assertEqual(a,self.rpc('iasdpi_registry_source_save',args));self.assertEqual(self.sql("select count(*) from public.schedule_legacy_commitments where person_id='%s'"%p),'1')
        ctx=self.rpc('iasdpi_schedule_rotation_context',[M,'2031-01-01']);person=next(x for x in ctx['people'] if x['person_id']==p);self.assertTrue(person['days'][0]['conflict']);self.assertEqual(self.sql("select original_name from public.schedule_legacy_commitments where person_id='%s'"%p),'Nome histórico intacto')
        history=self.rpc('iasdpi_registry_history',[p,D]);self.assertEqual(history['current'][0]['original_name'],'Nome histórico intacto')
    def test_reconciled_identity_cannot_silently_be_reassigned(self):
        p=self.person();other=self.person();self.link(p);self.link(other);ref={'department_id':D,'starts_on':'2031-01-01','ends_on':'2031-01-01','kind':'daily','original_name':'Histórico'}
        self.rpc('iasdpi_registry_source_save',['legacy:fixa',p,0,str(uuid.uuid4()),ref]);self.rpc('iasdpi_registry_source_save',['legacy:fixa',other,1,str(uuid.uuid4())],fail=True)
        self.assertEqual(self.sql("select person_id from public.schedule_source_links where source_key='legacy:fixa'"),p)
    def test_monthly_reconciliation_does_not_reserve_daily_commitments(self):
        p=self.person();self.link(p,E);ref={'department_id':E,'starts_on':'2031-01-01','ends_on':'2031-01-31','kind':'monthly','original_name':'Ancião histórico'}
        self.rpc('iasdpi_registry_source_save',['official:month',p,0,str(uuid.uuid4()),ref]);self.assertEqual(self.sql("select count(*) from public.schedule_legacy_commitments where person_id='%s'"%p),'0');self.assertIn('Ancião do Mês',self.rpc('iasdpi_registry_history',[p,E])['current'][0]['role'])
    def test_postinstall_checks(self):
        for name in ['check_church_isolation.sql','check_access_governance.sql','check_portal_integration.sql','check_elder_period_storage.sql','check_governance_integration.sql','check_department_schedule_days.sql','check_central_registry.sql']:
            self.assertEqual(self.sql((base.ROOT/'database'/name).read_text()),'',name)

import test_elder_storage_sql as g5
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class RegistryElderRegressionTests(RegistryMixin,g5.ElderStorageSQLTests):
    """Reexecuta cenários de persistência/conflitos G5 sobre o schema 017."""
