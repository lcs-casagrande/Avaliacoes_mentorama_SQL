"""G8.4: cadeia real 001–019 exclusivamente em PostgreSQL descartável."""
import json,subprocess,unittest,uuid,time
from pathlib import Path
import test_registry_consolidation_sql as g83
import test_user_management_sql as base
import test_church_isolation_sql as g1
import test_elder_storage_sql as g5
D=g83.D;M=g83.M
class IdentityMixin(g83.ConsolidatedRegistryMixin):
    @classmethod
    def setUpClass(cls):
        super().setUpClass();p=cls('runTest');seed=str(uuid.uuid4())
        p.sql("insert into public.schedule_people(id,name,display_name) values('%s','Luan','Luan')"%seed,database=cls.template16)
        before=p.sql('select jsonb_agg(to_jsonb(p) order by id) from public.schedule_people p',database=cls.template16)
        p.sql((base.ROOT/'database/019_registry_identities.sql').read_text(),database=cls.template16)
        after=p.sql("select jsonb_agg(to_jsonb(p)-'merged_into' order by id) from public.schedule_people p",database=cls.template16)
        cls.installation_preserved_people=before==after
        p.sql("delete from public.schedule_people where id='%s'"%seed,database=cls.template16)

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class RegistryIdentitySQLTests(IdentityMixin,g83.RegistryConsolidationSQLTests):
    def test_019_installation_preserves_existing_people_and_security_metadata(self):
        self.assertTrue(self.installation_preserved_people);self.assertEqual(self.sql((base.ROOT/'database/check_registry_identities.sql').read_text()),'')
    def named(self,name,dept=None):
        p=self.person();self.save(p,patch={'name':name});
        if dept:self.link(p,dept)
        return p
    def group(self,name):return next(g for g in self.rpc('iasdpi_registry_identity_preview',[])['groups'] if g['name']==name)
    def consolidate(self,name,canonical=None,fail=False,token=None,request=None):
        g=self.group(name);return self.rpc('iasdpi_registry_identity_apply',[name,canonical or g['people'][0]['id'],token or g['token'],request or str(uuid.uuid4())],fail=fail)
    def test_all_confirmed_names_and_no_extra_equivalences(self):
        rules=json.loads((base.ROOT/'data/confirmed-person-names.json').read_text());self.assertEqual(len(rules),13)
        self.assertEqual(json.loads(self.sql('select iasdpi_schedule_private.confirmed_person_names()')),rules)
        for rule in rules:
            if rule.get('department'):continue
            p=self.named(rule['aliases'][0]);self.consolidate(rule['name'],p);self.assertEqual(self.sql("select name from public.schedule_people where id='%s'"%p),rule['name'])
        self.assertEqual(self.rpc('iasdpi_registry_people',['Paulitos'])[0]['name'],'Paulo Scarpelini')
        self.assertNotEqual(self.rpc('iasdpi_registry_people',['Rafa'])[0]['id'],self.rpc('iasdpi_registry_people',['Raphael'])[0]['id'])
    def test_merge_disjoint_departments_keeps_links_qualifications_and_private_contact(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M);role=self.role(M);self.link(b,M,{'role_ids':[role],'is_ministry_head':True,'participation_confirmed':True,'weekdays':self.days('unavailable'),'max_monthly_count':3},version=1)
        self.rpc('iasdpi_schedule_save',['person',b,2,{'contact':'Contato fictício protegido'},str(uuid.uuid4())]);before=self.member(b,M);self.consolidate('Gabriel Macedo',a)
        after=self.member(a,M);self.assertEqual(after['id'],before['id']);self.assertEqual(after['max_monthly_count'],3);self.assertTrue(after['is_ministry_head']);self.assertTrue(after['participation_confirmed']);self.assertEqual(self.sql("select count(*) from public.schedule_memberships where person_id='%s'"%a),'2');self.assertEqual(self.sql("select count(*) from public.schedule_qualifications where membership_id='%s'"%after['id']),'1')
        self.assertEqual(self.rpc('iasdpi_schedule_person_details',[a])['contact'],'Contato fictício protegido');self.assertEqual(self.sql("select person_id from public.schedule_availability where department_id='%s'"%M),a)
        self.assertEqual(len([p for p in self.rpc('iasdpi_registry_people',['Macedo'])]),1);self.assertEqual(self.sql("select merged_into from public.schedule_people where id='%s'"%b),a)
        catalog=self.rpc('iasdpi_schedule_catalog',[]);self.assertNotIn(b,[p['id'] for p in catalog['people']]);self.assertEqual(next(x for x in catalog['identity_redirects'] if x['id']==b)['canonical_id'],a)
        refs=json.loads(self.sql("select reason from iasdpi_schedule_private.audit_logs where entity='registry-identity'"))['reference_ids_before'];self.assertTrue(any(x['person_id']==b for x in refs['schedule_memberships']))
    def test_duplicate_department_and_private_disagreement_block_without_changes(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',D);before=self.sql('select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.schedule_people p');self.assertTrue(self.group('Gabriel Macedo')['blockers']);self.consolidate('Gabriel Macedo',a,fail=True);self.assertEqual(before,self.sql('select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.schedule_people p'))
    def test_unknown_names_and_victoria_scope_are_not_inferred(self):
        p=self.named('Victoria',D);self.assertEqual(self.group('Victória Scarpelini')['people'],[])
        dep=str(uuid.uuid4());self.rpc('iasdpi_schedule_save',['department',dep,0,{'name':'Clube de Desbravadores','code':'clube-de-desbravadores'},str(uuid.uuid4())]);self.link(p,dep);self.consolidate('Victória Scarpelini',p);self.assertEqual(self.sql("select name from public.schedule_people where id='%s'"%p),'Victória Scarpelini')
        unknown=self.named('Rafael desconhecido');self.rpc('iasdpi_registry_identity_apply',['Rafael desconhecido',unknown,'x',str(uuid.uuid4())],fail=True)
    def test_confirmed_same_day_conflicts_are_blocked(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M)
        for p,d in [(a,D),(b,M)]:self.rpc('iasdpi_schedule_register_legacy',[[{'source_key':p,'person_id':p,'department_id':d,'date':'2031-01-01','original_name':'Original'}],str(uuid.uuid4())])
        self.assertTrue(any('mesmo dia' in x for x in self.group('Gabriel Macedo')['blockers']));self.consolidate('Gabriel Macedo',a,fail=True)
    def test_sources_dates_and_authorship_are_preserved(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M);ref={'department_id':M,'starts_on':'2031-01-01','ends_on':'2031-01-01','kind':'daily','original_name':'macedo Logos'}
        self.rpc('iasdpi_registry_source_save',['legacy:conservada',b,0,str(uuid.uuid4()),ref]);before=self.sql("select to_jsonb(l)-'person_id' from public.schedule_legacy_commitments l");self.consolidate('Gabriel Macedo',a)
        self.assertEqual(before,self.sql("select to_jsonb(l)-'person_id' from public.schedule_legacy_commitments l"));self.assertEqual(self.sql('select person_id from public.schedule_legacy_commitments'),a)
        self.assertEqual(self.sql("select updated_by from public.schedule_source_links where source_key='legacy:conservada'"),base.A)
        self.assertTrue(self.rpc('iasdpi_registry_audit',[a]));self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='registry-identity'"),'1')
    def test_published_plan_snapshots_immutable_and_new_version_uses_canonical_id(self):
        source=g5.ElderStorageSQLTests.person(self);self.save(source,patch={'name':'Macedo'});target=self.named('Gabriel Macedo',M);plan=g5.ElderStorageSQLTests.daily(self,source);self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())])
        before=self.sql("select md5(jsonb_agg(to_jsonb(v) order by version)::text) from public.schedule_versions v");self.consolidate('Gabriel Macedo',target)
        self.assertEqual(before,self.sql("select md5(jsonb_agg(to_jsonb(v) order by version)::text) from public.schedule_versions v where version<=2"));self.assertEqual(self.sql('select person_id from public.schedule_assignments'),target);self.assertEqual(self.sql('select version from public.schedule_plans'),'3');self.assertEqual(self.sql('select created_by from public.schedule_plans'),base.A)
        feed=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertIn('Gabriel Macedo',[x['person'] for x in feed]);self.assertTrue(self.rpc('iasdpi_registry_history',[target,D])['versions'])
    def test_aliases_are_searchable_after_unrelated_manual_rename(self):
        p=self.named('Nome antigo não listado');self.save(p,patch={'name':'Nome novo confirmado'});found=self.rpc('iasdpi_registry_people',['Nome antigo']);self.assertEqual(found[0]['id'],p);self.assertIn('Nome antigo não listado',found[0]['aliases'])
    def test_leader_anon_cross_church_and_direct_writes_denied(self):
        p=self.named('Luan');self.grant(flags={'view':True,'members':True});self.rpc('iasdpi_registry_identity_preview',[],base.U,True);self.rpc('iasdpi_registry_audit',[p],base.U,True);self.sql('select public.iasdpi_registry_identity_preview()',anonymous=True,fail=True);self.sql('select * from iasdpi_schedule_private.person_aliases',actor=base.A,fail=True)
        g=self.group('Luan Vaz');self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','OTHER','Igreja fictícia',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.B));self.church='OTHER';self.assertEqual(self.rpc('iasdpi_registry_identity_preview',[],base.B)['groups'],[]);self.rpc('iasdpi_registry_identity_apply',['Luan Vaz',p,g['token'],str(uuid.uuid4())],base.B,True)
    def test_stale_preview_private_or_department_changes_and_idempotent_retry(self):
        p=self.named('Luan',D);g=self.group('Luan Vaz');self.link(p,patch={'max_monthly_count':2},version=1);self.consolidate('Luan Vaz',p,token=g['token'],fail=True)
        g=self.group('Luan Vaz');req=str(uuid.uuid4());a=self.consolidate('Luan Vaz',p,token=g['token'],request=req);self.assertEqual(a,self.consolidate('Luan Vaz',p,token=g['token'],request=req))
    def test_actual_concurrent_identity_confirmation_has_one_winner(self):
        p=self.named('Luan');g=self.group('Luan Vaz');processes=[]
        for _ in range(2):
            sql="select public.iasdpi_registry_identity_apply('Luan Vaz','%s','%s','%s')"%(p,g['token'],uuid.uuid4());proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);proc.stdin.write(self.command(sql,base.A));proc.stdin.close();proc.stdin=None;processes.append(proc)
        outputs=[proc.communicate(timeout=30) for proc in processes];self.assertEqual(sum(proc.returncode==0 for proc in processes),1,outputs)
    def test_retired_id_cannot_be_reused_and_unknown_fk_blocks(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M);self.consolidate('Gabriel Macedo',a);self.save(b,patch={'active':True},fail=True);self.link(b,D,fail=True)
        self.sql('create table public.future_reference(person_id uuid references public.schedule_people(id))');self.assertTrue(self.group('Gabriel Macedo')['blockers'])
    def test_divergent_private_details_and_global_availability_require_review(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M)
        for p,contact in [(a,'Contato fictício A'),(b,'Contato fictício B')]:self.rpc('iasdpi_schedule_save',['person',p,2,{'contact':contact},str(uuid.uuid4())])
        self.assertTrue(any('Contatos' in x for x in self.group('Gabriel Macedo')['blockers']));self.consolidate('Gabriel Macedo',a,fail=True)
        self.rpc('iasdpi_schedule_save',['availability',str(uuid.uuid4()),0,{'person_id':a,'kind':'available','pattern':'weekly','weekdays':[0,6]},str(uuid.uuid4())]);self.assertTrue(any('global' in x for x in self.group('Gabriel Macedo')['blockers']))
    def test_elder_week_and_month_versions_and_dates_survive_merge(self):
        source=self.named('Raphael',g5.D);target=self.named('Raphael Moreira',D);workspace=self.rpc('iasdpi_schedule_elder_workspace',[g5.D,'2031-01-01',2031]);rows=[]
        for kind in ['weekly','monthly']:
            r=next(r for r in workspace['periods'] if r['kind']==kind);rows.append({k:r[k] for k in ['id','kind','starts_on','ends_on']}|{'person_id':source,'expected_version':0})
        for row in rows:self.rpc('iasdpi_schedule_elder_save',[g5.D,'published',[row],str(uuid.uuid4())])
        before=self.sql('select md5(jsonb_agg(to_jsonb(v) order by period_id)::text) from public.schedule_elder_versions v');dates=self.sql('select jsonb_agg(jsonb_build_array(id,kind,starts_on,ends_on,created_by) order by id) from public.schedule_elder_periods')
        self.consolidate('Raphael Moreira',target);self.assertEqual(dates,self.sql('select jsonb_agg(jsonb_build_array(id,kind,starts_on,ends_on,created_by) order by id) from public.schedule_elder_periods'));self.assertEqual(before,self.sql('select md5(jsonb_agg(to_jsonb(v) order by period_id)::text) from public.schedule_elder_versions v where version=1'));self.assertEqual(self.sql('select count(*) from public.schedule_elder_versions'),'4');self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.confirmed_days where person_id='%s'"%target),'7')
    def test_draft_keeps_old_published_snapshot_resolved_by_canonical_id(self):
        source=g5.ElderStorageSQLTests.person(self);self.save(source,patch={'name':'Macedo'});target=self.named('Gabriel Macedo',M);plan=g5.ElderStorageSQLTests.daily(self,source);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())]);self.rpc('iasdpi_schedule_plan_save',[plan['id'],2,{'status':'draft'},str(uuid.uuid4())]);before=self.sql('select snapshot from public.schedule_versions where version=2');self.consolidate('Gabriel Macedo',target);self.assertEqual(before,self.sql('select snapshot from public.schedule_versions where version=2'));self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.confirmed_days where person_id='%s'"%target),'1')
        feed=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(feed[0]['person'],'Gabriel Macedo');self.assertEqual(feed[0]['version'],2)
    def test_alias_overlap_is_only_a_duplicate_indicator_not_an_automatic_merge(self):
        a=self.named('Nome não confirmado');self.save(a,patch={'name':'Outro nome não confirmado'});b=self.named('Nome não confirmado');groups=self.rpc('iasdpi_registry_identity_preview',[])['possible_duplicates'];self.assertTrue(any({p['id'] for p in g['people']}=={a,b} for g in groups));self.assertEqual(self.sql('select count(*) from public.schedule_people where merged_into is not null'),'0')
    def test_existing_auth_identity_is_preserved_without_role_escalation(self):
        a=self.named('Macedo',D);b=self.named('macedo Logos',M);self.rpc('iasdpi_schedule_save',['person',b,2,{'auth_user_id':base.U},str(uuid.uuid4())]);before=self.sql('select jsonb_agg(to_jsonb(a) order by user_id) from public.iasdpi_access a');self.consolidate('Gabriel Macedo',a);self.assertEqual(self.sql("select auth_user_id from public.schedule_people where id='%s'"%a),base.U);self.assertEqual(before,self.sql('select jsonb_agg(to_jsonb(a) order by user_id) from public.iasdpi_access a'));self.assertEqual(self.sql("select iasdpi_schedule_private.is_admin('%s')"%base.U),'f')
    def test_identity_preview_fits_client_timeout_without_changing_global_jit(self):
        self.named('Luan',D);jit=self.sql('show jit');start=time.perf_counter();groups=self.rpc('iasdpi_registry_identity_preview',[])['groups'];elapsed=time.perf_counter()-start;self.assertEqual(len(groups),13);self.assertLess(elapsed,8);self.assertEqual(self.sql('show jit'),jit)
        output=base.ROOT/'dist/registry-g84';output.mkdir(parents=True,exist_ok=True);(output/'performance-evidence.json').write_text(json.dumps({'scenario':'13 grupos de nomes, dados sintéticos em PostgreSQL local','preview_seconds':round(elapsed,4),'frontend_timeout_seconds':10,'jit_setting_restored':self.sql('show jit')==jit,'production_queried':False},ensure_ascii=False,indent=2))
    def test_legacy_person_rpc_cannot_bypass_central_administration(self):
        self.grant(flags={'view':True,'members':True});self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Pessoa forjada pelo caminho antigo','department_id':D},str(uuid.uuid4())],base.U,True)
        self.sql("select iasdpi_schedule_private.save_g83('person',gen_random_uuid(),0,'{}',gen_random_uuid())",actor=base.U,fail=True)
        p=self.named('Pessoa central autorizada',D);self.link(p,patch={'max_monthly_count':2},version=1,actor=base.U);self.assertEqual(self.member(p)['max_monthly_count'],2)
    def test_later_name_edit_syncs_retired_ids_without_rewriting_versions(self):
        source=g5.ElderStorageSQLTests.person(self);self.save(source,patch={'name':'Macedo'});target=self.named('Gabriel Macedo',M);plan=g5.ElderStorageSQLTests.daily(self,source);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())]);self.consolidate('Gabriel Macedo',target)
        before=self.sql('select md5(jsonb_agg(to_jsonb(v) order by version)::text) from public.schedule_versions v');self.save(target,patch={'display_name':'Gabriel Macedo · nome preferido fictício'})
        self.assertEqual(self.sql("select display_name from public.schedule_people where id='%s'"%source),'Gabriel Macedo · nome preferido fictício');self.assertEqual(before,self.sql('select md5(jsonb_agg(to_jsonb(v) order by version)::text) from public.schedule_versions v'));self.assertEqual(self.rpc('iasdpi_registry_people',['macedo Logos'])[0]['id'],target)
        feed=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(feed[0]['person'],'Gabriel Macedo · nome preferido fictício')
