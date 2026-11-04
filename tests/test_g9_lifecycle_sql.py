"""G9: atualização 004→019, estado sintético, persistência e recuperação isoladas."""
import copy,json,subprocess,sys,unittest,uuid
from pathlib import Path
import test_user_management_sql as base
import test_operational_sql as operational
import test_access_governance_sql as g3
import test_church_isolation_sql as g1
import test_alias_login_sql as g2
sys.path.insert(0,str(base.ROOT/'scripts'))
import compare_g9_snapshots as diff
D='a0000000-0000-4000-8000-000000000001';M='a0000000-0000-4000-8000-000000000003';E='a0000000-0000-4000-8000-000000000004'
OUT=base.ROOT/'dist/governance-g9'
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class G9LifecycleSQLTests(unittest.TestCase):
    sql=base.UserManagementSQLTests.sql;command=g3.AccessGovernanceSQLTests.command;quote=staticmethod(g1.ChurchIsolationSQLTests.quote);rpc=g1.ChurchIsolationSQLTests.rpc;grant=g3.AccessGovernanceSQLTests.grant;service=g2.AliasLoginSQLTests.service
    @classmethod
    def setUpClass(cls):
        base.UserManagementSQLTests.setUpClass.__func__(cls);p=cls('runTest');p.church='IASD_PI';p.iat=None;operational.OperationalSQLTests.setUp(p);cls.addClassCleanup(p.doCleanups);p.p['id']='g9-synthetic-finalized';p.p['plan']['name']='Culto sintético G9';operational.OperationalSQLTests.call(p)
        # Papel do provedor: a suíte deve funcionar também como primeiro teste de um cluster vazio.
        p.sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN;END IF;END $$")
        p.sql((base.ROOT/'database/004_culto_trash.sql').read_text());trash=copy.deepcopy(p.p);trash.update(id='g9-synthetic-trash',status='Planejamento',executions={},actual_details={});operational.OperationalSQLTests.call(p,trash);p.rpc('iasdpi_trash_program',[trash['id'],1,str(uuid.uuid4()),'Rascunho exclusivamente sintético'])
        cls.template4=p.db;cls.before=p.snapshot();OUT.mkdir(parents=True,exist_ok=True);(OUT/'expected-004.json').write_text(json.dumps(cls.before,ensure_ascii=False,indent=2)+'\n')
        cls.template19='iasdpi_g9_template_'+uuid.uuid4().hex;p.sql('create database '+cls.template19+' template '+p.db,database='postgres');cls.addClassCleanup(p.sql,'drop database '+cls.template19+' with (force)',database='postgres');p.db=cls.template19;cls.steps=[]
        for number in range(5,20):
            files=[f for f in (base.ROOT/'database').glob(f'{number:03d}_*.sql') if not f.name.endswith('_down.sql')]
            if len(files)!=1:raise RuntimeError('Migração ausente/duplicada: '+str(number))
            p.sql(files[0].read_text());s=p.snapshot();preserved=s['core_fingerprints']==cls.before['core_fingerprints'];cls.steps.append({'migration':files[0].name,'core_preserved':preserved})
            if not preserved:raise RuntimeError('Mudança não esperada no núcleo: '+files[0].name)
        cls.after=p.snapshot();(OUT/'expected-019.json').write_text(json.dumps(cls.after,ensure_ascii=False,indent=2)+'\n');(OUT/'migration-rehearsal.json').write_text(json.dumps({'baseline':'synthetic 001–004, not a production clone','steps':cls.steps,'production_touched':False},ensure_ascii=False,indent=2)+'\n')
    def setUp(self):
        self.church='IASD_PI';self.iat=None;self.db='iasdpi_g9_case_'+uuid.uuid4().hex;self.sql('create database '+self.db+' template '+self.template19,database='postgres');self.addCleanup(self.sql,'drop database '+self.db+' with (force)',database='postgres')
    def snapshot(self):
        return json.loads(self.sql('BEGIN TRANSACTION READ ONLY;'+(base.ROOT/'database/check_g9_baseline.sql').read_text()+'COMMIT;'))
    def person(self,name='Participante sintético G9',departments=(D,)):
        p=str(uuid.uuid4());self.rpc('iasdpi_registry_save',[p,0,{'name':name},[],str(uuid.uuid4())]);links=[]
        for d in departments:
            r=self.rpc('iasdpi_schedule_daily_role',[d]);links.append({'department_id':d,'expected_version':0,'patch':{'participation_confirmed':True,'role_ids':[r['id']],'weekdays':{str(i):'available' for i in range(7)}}})
        self.rpc('iasdpi_registry_save',[p,1,{},links,str(uuid.uuid4())]);return p
    def plan(self,p,d=D,day='2031-01-01'):
        role=self.rpc('iasdpi_schedule_daily_role',[d]);event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':d,'title':'Evento sintético G9','date':day},str(uuid.uuid4())]);return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':d,'month':day[:7]+'-01','title':'Escala sintética G9','requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':1,'notes':'NOTA PRIVADA SINTÉTICA','assignments':[{'id':str(uuid.uuid4()),'person_id':p}]}]},str(uuid.uuid4())])
    def digests(self):
        names=self.sql("select schemaname||'.'||tablename from pg_tables where schemaname in('public','auth') or schemaname like 'iasdpi_%' order by 1").splitlines();return {t:self.sql("select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text) from "+t+' x') for t in names}
    def test_004_to_019_preserves_documents_admin_templates_and_history(self):
        self.assertTrue(all(x['core_preserved'] for x in self.steps));self.assertEqual(self.before['core_fingerprints']['public.iasdpi_programs']['rows'],2);self.assertEqual(self.sql('select count(*) from public.iasdpi_programs where deleted_at is not null'),'1');self.assertEqual(self.sql("select role||':'||enabled from public.iasdpi_access where user_id='%s'"%base.A),'admin:true');self.assertEqual(self.sql("select string_agg(id||':'||jsonb_array_length(plan->'items'),',' order by id) from public.iasdpi_templates"),'culto-03102026:16,free:0,liturgy-i:16')
    def test_postinstall_checks_and_anonymous_private_access(self):
        for file in ['check_church_isolation.sql','check_alias_login.sql','check_access_governance.sql','check_portal_integration.sql','check_elder_period_storage.sql','check_governance_integration.sql','check_department_schedule_days.sql','check_central_registry.sql','check_registry_identities.sql']:self.assertEqual(self.sql((base.ROOT/'database'/file).read_text()),'',file)
        self.sql('select public.iasdpi_registry_catalog()',anonymous=True,fail=True);self.sql('delete from public.iasdpi_programs',actor=base.A,fail=True);self.assertEqual(self.snapshot()['core_fingerprints'],self.before['core_fingerprints'])
    def test_alias_multiple_permissions_remain_on_authenticated_identity(self):
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True,'members':True});self.grant(user=base.U,dept=M,flags={'view':True,'edit':True,'publish':True,'members':True});reserved=next(x for x in self.rpc('iasdpi_alias_list',[]) if x['identifier']=='sonoplastia');self.rpc('iasdpi_alias_save',['sonoplastia',base.U,True,reserved['version'],'Vínculo sintético G9 confirmado']);self.rpc('iasdpi_alias_save',['som.individual.g9',base.U,True,0,'Vínculo sintético G9 confirmado'])
        self.assertEqual(self.service('iasdpi_alias_login_lookup',['sonoplastia'])['user_id'],base.U);self.assertEqual(self.service('iasdpi_alias_login_lookup',['som.individual.g9'])['user_id'],base.U);ctx=self.rpc('iasdpi_portal_context',[],base.U);self.assertFalse(ctx['is_admin']);self.assertEqual({d['id'] for d in ctx['departments']},{D,M});self.rpc('iasdpi_schedule_workspace',[E,'2031-01-01'],base.U,True);self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.U),'0')
    def test_shared_publication_cas_and_transactional_conflict(self):
        p=self.person(departments=(D,M));a=self.plan(p,D);b=self.plan(p,M);processes=[]
        for user,dep in [(base.U,D),(base.V,M)]:self.grant(user=user,dept=dep,flags={'view':True,'edit':True,'publish':True})
        for plan,user in [(a,base.U),(b,base.V)]:
            query="select public.iasdpi_schedule_plan_save('%s',1,'{\"status\":\"published\"}','%s')"%(plan['id'],uuid.uuid4());proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);proc.stdin.write(self.command(query,user));proc.stdin.close();proc.stdin=None;processes.append(proc)
        outputs=[proc.communicate(timeout=30) for proc in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs);feed=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(len(feed),1);self.assertNotIn('NOTA PRIVADA',json.dumps(feed));self.assertEqual(self.snapshot()['core_fingerprints'],self.before['core_fingerprints'])
    def test_backup_restore_all_data_and_refusal_of_unsafe_down(self):
        p=self.person('Macedo',(D,));other=self.person('macedo Logos',(M,));group=next(g for g in self.rpc('iasdpi_registry_identity_preview',[])['groups'] if g['name']=='Gabriel Macedo');self.rpc('iasdpi_registry_identity_apply',['Gabriel Macedo',p,group['token'],str(uuid.uuid4())]);plan=self.plan(p);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())]);before=self.digests();self.sql((base.ROOT/'database/015_elder_period_storage_down.sql').read_text(),fail=True);self.assertEqual(before,self.digests())
        dump=subprocess.run(self.docker+['exec',base.CONTAINER,'pg_dump','-Fc','-U','postgres','-d',self.db],capture_output=True,env=self.env,check=True).stdout;restored='iasdpi_g9_restore_'+uuid.uuid4().hex;self.sql('create database '+restored,database='postgres');self.addCleanup(self.sql,'drop database '+restored+' with (force)',database='postgres');r=subprocess.run(self.docker+['exec','-i',base.CONTAINER,'pg_restore','--exit-on-error','-U','postgres','-d',restored],input=dump,capture_output=True,env=self.env);self.assertEqual(r.returncode,0,r.stderr.decode());self.db=restored;self.assertEqual(before,self.digests());self.assertEqual(self.sql((base.ROOT/'database/check_registry_identities.sql').read_text()),'');self.sql('select * from iasdpi_schedule_private.person_aliases',anonymous=True,fail=True);(OUT/'restore-evidence.json').write_text(json.dumps({'tables_compared':len(before),'all_data_digests_equal':True,'private_access_denied_after_restore':True,'production_touched':False},indent=2)+'\n')
    def test_name_conciliation_is_optional_and_preview_does_not_write(self):
        self.assertEqual(self.sql('select count(*) from public.schedule_people'),'0');a=self.person('Macedo',(D,));b=self.person('macedo Logos',(M,));before=self.digests();self.rpc('iasdpi_registry_identity_preview',[]);self.assertEqual(before,self.digests());self.assertEqual({p['id'] for p in self.rpc('iasdpi_registry_people',['Macedo'])},{a,b})
    def test_partial_church_state_does_not_allow_default_migration_plan(self):
        db='iasdpi_g9_partial_'+uuid.uuid4().hex;self.sql('create database '+db+' template '+self.template4,database='postgres');self.addCleanup(self.sql,'drop database '+db+' with (force)',database='postgres');self.db=db;self.sql((base.ROOT/'database/006_schedule_management.sql').read_text(),fail=True);self.assertIsNone(self.snapshot()['relations'] and next((r for r in self.snapshot()['relations'] if r['name']=='public.schedule_people'),None));self.sql((base.ROOT/'database/011_church_isolation.sql').read_text());self.assertEqual(diff.readiness(self.snapshot())['state'],'church_before_schedules')
    def test_shared_edit_by_two_different_identities_keeps_id_and_rejects_stale_save(self):
        p=self.person();plan=self.plan(p)
        for user in [base.U,base.V]:self.grant(user=user,dept=D,flags={'view':True,'edit':True,'publish':True})
        self.assertEqual(self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01'],base.U)['plan']['id'],plan['id']);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Edição sintética U'},str(uuid.uuid4())],base.U);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Edição obsoleta V'},str(uuid.uuid4())],base.V,True);latest=self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01'],base.V)['plan'];self.assertEqual(latest['version'],2);saved=self.rpc('iasdpi_schedule_plan_save',[plan['id'],2,{'title':'Edição sintética V'},str(uuid.uuid4())],base.V);self.assertEqual(saved['requirements'],latest['requirements']);self.assertEqual(self.sql('select count(*) from public.schedule_plans'),'1')
    def test_018_reapplication_after_019_is_detected_by_definition_comparison(self):
        self.sql((base.ROOT/'database/018_registry_search.sql').read_text());result=diff.compare(self.after,self.snapshot());self.assertFalse(result['structure_matches']);self.assertTrue(any('iasdpi_registry_people' in name for name in result['changes']['functions']['changed']))
