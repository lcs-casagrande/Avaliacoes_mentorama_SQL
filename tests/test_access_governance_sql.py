"""G3: PostgreSQL descartável sem rede; nenhuma conta ou dado real."""
import json
import subprocess
import unittest
import uuid
import test_user_management_sql as base
import test_church_isolation_sql as g1
import test_alias_login_sql as g2

D=g1.D
E='a0000000-0000-4000-8000-000000000003'
@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável --network none')
class AccessGovernanceSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    sql=base.UserManagementSQLTests.sql
    quote=staticmethod(g1.ChurchIsolationSQLTests.quote)
    rpc=g1.ChurchIsolationSQLTests.rpc
    service=g2.AliasLoginSQLTests.service
    def command(self,source,actor=None,anonymous=False):
        claims=json.dumps({'sub':actor,'role':'anon' if anonymous else 'authenticated','is_anonymous':False,**({'iat':self.iat} if getattr(self,'iat',None) is not None else {})})
        if actor or anonymous:return "begin;set local role %s;set local request.jwt.claims='%s';set local request.headers='%s';%s;commit;"%('anon' if anonymous else 'authenticated',claims,json.dumps({'x-iasdpi-church':self.church}),source)
        return source
    def setUp(self):
        self.church='IASD_PI';self.iat=None;base.UserManagementSQLTests.setUp(self)
        self.sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN;END IF;END $$")
        for name in ['003_operational_storage.sql','004_culto_trash.sql','005_schedule_foundation.sql','006_schedule_management.sql','007_daily_schedules.sql','008_monthly_rotation.sql','009_confirmed_schedule_conflicts.sql','010_simple_daily_schedules.sql','011_church_isolation.sql','012_alias_login.sql','013_access_governance.sql']:self.sql((base.ROOT/'database'/name).read_text())
    def grant(self,user=base.U,dept=D,flags=None,status='active',version=0,actor=base.A,fail=False):
        return self.rpc('iasdpi_department_access_save',[dept,user,flags or {'view':True},status,version],actor,fail)
    def request(self,user=base.U,department=D,kind='password'):
        alias='test.'+user[:8]
        if not any(a['identifier']==alias for a in self.rpc('iasdpi_alias_list',[])):self.rpc('iasdpi_alias_save',[alias,user,True,0,'Vínculo de homologação descartável'])
        rid=str(uuid.uuid4());self.service('iasdpi_access_request_submit',[rid,'Pessoa descartável',alias,department,kind,'Pedido fictício']);return rid
    def verified(self,user=base.U,department=D,actor=base.A):
        rid=self.request(user,department);self.rpc('iasdpi_access_request_review',[rid,1,'verified','Identidade verificada por canal presencial'],actor);return rid
    def test_installation_and_acl(self):
        self.assertTrue(self.rpc('iasdpi_governance_catalog',[])['is_admin'])
        self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
        self.assertEqual(self.sql((base.ROOT/'database/check_alias_login.sql').read_text()),'')
        self.assertEqual(self.sql((base.ROOT/'database/check_access_governance.sql').read_text()),'')
        self.assertEqual(self.sql('select count(*) from public.culto_archives'),'1')
        for table in ['iasdpi_admin_private.identity_states','iasdpi_admin_private.access_requests','iasdpi_admin_private.reset_capabilities','iasdpi_governance_private.identity_epochs']:
            self.sql('select * from '+table,actor=base.A,fail=True)
        for name,args in [('iasdpi_governance_catalog',''),('iasdpi_access_requests',''),('iasdpi_access_reset_claim',"repeat('a',64)"),('iasdpi_access_request_submit',"gen_random_uuid(),'Pessoa','nome',null,'access',''")]:
            self.sql('select public.'+name+'('+args+')',anonymous=True,fail=True)
        self.sql("select public.iasdpi_access_reset_claim(repeat('a',64))",actor=base.A,fail=True)
    def test_multiple_departments_and_granular_permissions(self):
        self.grant(flags={'view':True,'edit':True});self.grant(dept=E,flags={'view':True,'publish':True})
        c=self.rpc('iasdpi_schedule_catalog',[],base.U);a=next(d for d in c['departments'] if d['id']==D);b=next(d for d in c['departments'] if d['id']==E)
        self.assertTrue(a['can_edit']);self.assertFalse(a['can_publish']);self.assertFalse(a['can_manage_members']);self.assertTrue(b['can_publish']);self.assertFalse(b['can_edit'])
        self.rpc('iasdpi_schedule_daily_role',[D],base.U)
        self.rpc('iasdpi_schedule_daily_role',[E],base.U,True)
        self.rpc('iasdpi_schedule_save',['role',str(uuid.uuid4()),0,{'department_id':D,'name':'Não permitido'},str(uuid.uuid4())],base.U,True)
        self.rpc('iasdpi_schedule_save',['access',str(uuid.uuid4()),0,{'department_id':D,'user_id':base.U,'access_level':'manager'},str(uuid.uuid4())],base.U,True)
        self.rpc('iasdpi_governance_catalog',[],base.U,True)
    def test_ministerial_delegation_cannot_cross_scope_or_self_promote(self):
        self.grant(flags={'view':True,'edit':True,'access':True});self.grant(user=base.V)
        self.grant(user=base.V,flags={'edit':True},version=1,actor=base.U)
        self.grant(user=base.V,dept=E,actor=base.U,fail=True)
        self.grant(user=base.U,flags={'publish':True},version=1,actor=base.U,fail=True)
        self.grant(user=base.V,flags={'publish':True},version=2,actor=base.U,fail=True)
        self.grant(user=base.V,flags={'access':True},version=2,actor=base.U,fail=True)
        self.grant(user=base.B,actor=base.U,fail=True)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'0')
    def test_last_admin_and_suspension_and_reactivation(self):
        self.rpc('iasdpi_identity_state_save',[base.A,'suspended','Tentativa no último administrador'],fail=True)
        self.rpc('iasdpi_set_access',[base.A,'leader',True],fail=True)
        self.grant(flags={'view':True,'members':True})
        self.rpc('iasdpi_identity_state_save',[base.U,'suspended','Suspensão de homologação isolada'])
        self.rpc('iasdpi_schedule_catalog',[],base.U,True)
        self.rpc('iasdpi_identity_state_save',[base.U,'active','Reativação de homologação isolada'])
        self.assertFalse(self.rpc('iasdpi_schedule_catalog',[],base.U)['is_admin'])
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'0')
    def test_revocation_and_leader_handover_preserve_alias_identity(self):
        self.grant(flags={'view':True,'members':True,'access':True})
        self.rpc('iasdpi_alias_save',['sonoplastia',base.U,True,1,'Líder ministerial de teste'])
        self.grant(status='revoked',version=1)
        self.rpc('iasdpi_schedule_catalog',[],base.U,True)
        self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']))
        self.grant(user=base.V,flags={'view':True,'edit':True})
        self.rpc('iasdpi_alias_save',['sonoplastia',base.V,True,2,'Troca confirmada de responsável'])
        self.assertEqual(self.service('iasdpi_alias_login_lookup',['sonoplastia'])['user_id'],base.V)
        self.sql("update auth.users set email_confirmed_at=null where id='%s'"%base.V);self.grant(user=base.V,status='suspended',version=1)
    def test_optimistic_concurrency_does_not_lose_access_flags(self):
        self.grant(flags={'view':True,'members':True})
        self.grant(flags={'edit':True},version=1)
        self.grant(flags={'publish':True},version=1,fail=True)
        row=next(a for a in self.rpc('iasdpi_governance_catalog',[])['access'] if a['user_id']==base.U)
        self.assertTrue(row['can_manage_members']);self.assertTrue(row['can_edit']);self.assertFalse(row['can_publish']);self.assertEqual(row['version'],2)
    def test_password_queue_verification_expiry_single_use_and_epoch(self):
        self.grant();rid=self.verified();h='a'*64
        self.rpc('iasdpi_access_reset_issue',[rid,2,h]);self.sql("update iasdpi_admin_private.reset_capabilities set expires_at=created_at+interval '1 microsecond' where token_hash='%s'"%h)
        self.service('iasdpi_access_reset_claim',[h],True)
        self.rpc('iasdpi_access_reset_issue',[rid,3,'b'*64]);cap=self.service('iasdpi_access_reset_claim',['b'*64])
        self.assertEqual(cap['user_id'],base.U);self.service('iasdpi_access_reset_claim',['b'*64],True)
        self.rpc('iasdpi_schedule_catalog',[],base.U,True)
        self.service('iasdpi_access_reset_finish',[cap['lease'],True]);self.service('iasdpi_access_reset_finish',[cap['lease'],True],True)
        self.rpc('iasdpi_schedule_catalog',[],base.U,True)
        self.iat=int(self.sql('select extract(epoch from now())::bigint'))+5
        self.rpc('iasdpi_schedule_catalog',[],base.U)
        self.assertEqual(self.rpc('iasdpi_access_requests',[])[0]['status'],'resolved')
    def test_failed_reset_blocks_old_sessions_and_cached_helper_paths(self):
        self.grant();rid=self.verified();self.rpc('iasdpi_access_reset_issue',[rid,2,'c'*64]);cap=self.service('iasdpi_access_reset_claim',['c'*64]);self.service('iasdpi_access_reset_finish',[cap['lease'],False])
        self.rpc('iasdpi_schedule_catalog',[],base.U,True);self.assertIsNone(self.service('iasdpi_alias_login_lookup',['test.'+base.U[:8]]))
        self.assertEqual(self.sql('select count(*) from public.iasdpi_templates',actor=base.U),'0')
        self.sql("select public.iasdpi_accept_invite(repeat('a',64))",actor=base.U,fail=True)
    def test_request_scope_self_approval_and_elder_name_no_permissions(self):
        self.grant(flags={'view':True,'requests':True});self.grant(user=base.V)
        rid=self.request(base.V);self.rpc('iasdpi_access_request_review',[rid,1,'verified','Confirmação pessoal de homologação'],base.U)
        self.rpc('iasdpi_access_reset_issue',[rid,2,'d'*64],base.U)
        self.grant(user=base.V,dept=E)
        self.service('iasdpi_access_reset_claim',['d'*64],True)
        own=self.request(base.U);self.rpc('iasdpi_access_request_review',[own,1,'verified','Tentativa de autoaprovação isolada'],base.U,True)
        self.rpc('iasdpi_alias_save',['anciaos',base.V,True,1,'Apelido sem privilégio implícito']);self.rpc('iasdpi_governance_catalog',[],base.V,True)
    def test_other_church_isolation_and_global_identity_reset_is_denied(self):
        self.grant();rid=self.verified()
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin'),('%s','%s','leader')"%(g1.OTHER,g1.OTHER,base.B,g1.OTHER,base.U))
        self.rpc('iasdpi_access_reset_issue',[rid,2,'e'*64],fail=True)
        self.church='TEST_ONLY';self.assertEqual(self.rpc('iasdpi_access_requests',[],base.B),[])
        self.rpc('iasdpi_access_request_review',[rid,2,'verified','Tentativa de outra igreja'],base.B,True)
        self.grant(user=base.V,actor=base.A,fail=True)
        self.assertEqual(self.rpc('iasdpi_governance_catalog',[],base.B)['church_id'],g1.OTHER)
    def test_concurrent_permission_changes_have_exactly_one_winner(self):
        self.grant();processes=[]
        for flags in [{'edit':True},{'members':True}]:
            q=self.command("select public.iasdpi_department_access_save('%s','%s','%s','active',1);select pg_sleep(0.15)"%(D,base.U,json.dumps(flags)),actor=base.A)
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(q);p.stdin.close();p.stdin=None;processes.append(p)
        codes=[]
        for p in processes:p.communicate(timeout=30);codes.append(p.returncode)
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(self.sql("select version from public.schedule_department_access where user_id='%s'"%base.U),'2')
    def test_concurrent_admin_revocations_leave_one_active_admin(self):
        self.rpc('iasdpi_set_access',[base.B,'admin',True]);processes=[]
        for actor,target in [(base.A,base.B),(base.B,base.A)]:
            q=self.command("select public.iasdpi_identity_state_save('%s','suspended','Homologação de concorrência isolada');select pg_sleep(0.15)"%target,actor=actor)
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(q);p.stdin.close();p.stdin=None;processes.append(p)
        codes=[]
        for p in processes:p.communicate(timeout=30);codes.append(p.returncode)
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(self.sql("select count(*) from public.iasdpi_access where role='admin' and enabled"),'1')
    def test_publisher_cannot_edit_and_editor_cannot_publish(self):
        self.grant(flags={'view':True,'edit':True});self.grant(user=base.V,flags={'view':True,'publish':True})
        plan=self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':D,'month':'2031-01-01','title':'Escala isolada','requirements':[]},str(uuid.uuid4())],base.U)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Alteração proibida'},str(uuid.uuid4())],base.V,True)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())],base.U,True)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())],base.V,True) # sem vagas: validação original permanece
        updated=self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Rascunho revisado'},str(uuid.uuid4())],base.U)
        self.assertEqual(updated['version'],2)
    def test_request_null_version_cannot_bypass_concurrency(self):
        self.grant();rid=self.request()
        self.rpc('iasdpi_access_request_review',[rid,None,'verified','Confirmação fora do site'],fail=True)
        self.rpc('iasdpi_access_reset_issue',[rid,None,'a'*64],fail=True)
        self.assertEqual(self.rpc('iasdpi_access_requests',[])[0]['status'],'pending')
    def test_only_one_reset_can_run_per_identity(self):
        self.grant();first=self.verified();second=self.request()
        self.rpc('iasdpi_access_request_review',[second,1,'verified','Identidade confirmada presencialmente'])
        self.rpc('iasdpi_access_reset_issue',[first,2,'a'*64]);self.rpc('iasdpi_access_reset_issue',[second,2,'b'*64])
        cap=self.service('iasdpi_access_reset_claim',['a'*64]);self.service('iasdpi_access_reset_claim',['b'*64],True)
        self.service('iasdpi_access_reset_finish',[cap['lease'],False])
    def test_old_jwt_cannot_read_global_access_or_use_valid_invite_after_reset(self):
        self.grant();rid=self.verified();self.rpc('iasdpi_access_reset_issue',[rid,2,'d'*64]);cap=self.service('iasdpi_access_reset_claim',['d'*64]);self.service('iasdpi_access_reset_finish',[cap['lease'],True])
        self.assertEqual(self.sql('select count(*) from public.iasdpi_access',actor=base.U),'0')
        self.rpc('iasdpi_list_trash',[],base.U,True)
        self.rpc('iasdpi_set_access',[base.B,'admin',True])
        # Um convite válido não elimina a barreira da sessão anterior.
        invite=json.loads(self.sql("select row_to_json(x) from public.iasdpi_create_invite('new@example.invalid') x",actor=base.A))
        self.rpc('iasdpi_accept_invite',[invite['token']],base.U,True)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'0')
    def test_real_publish_only_role_can_publish_an_existing_complete_draft(self):
        def save(entity,data,id=None,version=0):return self.rpc('iasdpi_schedule_save',[entity,id or str(uuid.uuid4()),version,data,str(uuid.uuid4())])
        person=save('person',{'name':'Pessoa fictícia','display_name':'Pessoa fictícia','department_id':D})
        role=self.rpc('iasdpi_schedule_daily_role',[D]);role_id=role['id'] if isinstance(role,dict) else role
        membership=self.rpc('iasdpi_schedule_catalog',[])['memberships'][0]
        save('membership',{'role_ids':[role_id]},membership['id'],membership['version'])
        event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Evento fictício','date':'2031-01-01'},str(uuid.uuid4())])
        requirement={'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role_id,'required_count':1,'assignments':[{'id':str(uuid.uuid4()),'person_id':person['id']}]}
        plan=self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':D,'month':'2031-01-01','title':'Escala completa isolada','requirements':[requirement]},str(uuid.uuid4())])
        self.grant(flags={'view':True,'publish':True})
        published=self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())],base.U)
        self.assertEqual(published['status'],'published');self.assertEqual(published['version'],2)
    def test_inflight_reset_prevents_new_church_associations(self):
        self.grant();rid=self.verified();self.rpc('iasdpi_access_reset_issue',[rid,2,'f'*64]);cap=self.service('iasdpi_access_reset_claim',['f'*64])
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.B))
        self.church='TEST_ONLY'
        self.rpc('iasdpi_set_access',[base.U,'leader',True],base.B,True)
        self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Pessoa descartável','display_name':'Pessoa descartável','auth_user_id':base.U},str(uuid.uuid4())],base.B,True)
        self.church='IASD_PI';self.service('iasdpi_access_reset_finish',[cap['lease'],True])
        self.church='TEST_ONLY';self.rpc('iasdpi_set_access',[base.U,'leader',True],base.B)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where church_id='%s' and user_id='%s'"%(g1.OTHER,base.U)),'1')
    def test_revoked_explicit_acl_cannot_fall_back_to_linked_participant_access(self):
        person=self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Pessoa fictícia','display_name':'Pessoa fictícia','department_id':D,'auth_user_id':base.U},str(uuid.uuid4())])
        self.grant();self.rpc('iasdpi_alias_save',['sonoplastia',base.U,True,1,'Vínculo de identidade para teste']);self.assertIsNotNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']))
        self.grant(status='revoked',version=1);self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']));self.rpc('iasdpi_schedule_catalog',[],base.U,True)
    def test_public_request_cannot_route_other_accounts_to_ministerial_reviewer(self):
        self.grant(flags={'view':True,'requests':True});self.grant(user=base.V,dept=E)
        self.request(base.V,department=D);self.request(base.L,department=D)
        self.assertEqual(self.rpc('iasdpi_access_requests',[],base.U),[])
        self.assertEqual(len(self.rpc('iasdpi_access_requests',[])),2)
    def test_repeatable_read_cannot_link_a_snapshot_from_before_reset(self):
        self.grant();rid=self.verified();self.rpc('iasdpi_access_reset_issue',[rid,2,'f'*64])
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.B))
        self.church='TEST_ONLY';q=self.command("select public.iasdpi_current_church_id();select pg_sleep(1);select public.iasdpi_set_access('%s','leader',true)"%base.U,actor=base.B).replace('begin;','begin isolation level repeatable read;',1)
        p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(q);p.stdin.close();p.stdin=None
        self.assertEqual(p.stdout.readline().strip(),g1.OTHER);self.church='IASD_PI';cap=self.service('iasdpi_access_reset_claim',['f'*64]);stdout,stderr=p.communicate(timeout=30);self.assertNotEqual(p.returncode,0);self.assertIn('serialize',stderr)
        self.service('iasdpi_access_reset_finish',[cap['lease'],False])
    def test_additive_migration_preserves_saved_records_and_old_manager_access(self):
        fixture=g1.ChurchIsolationSQLTests('test_backfill_preserves_all_old_payloads_ids_times_and_admin');fixture.setUpClass();fixture.setUp();self.addCleanup(fixture.doCleanups)
        fixture.sql((base.ROOT/'database/012_alias_login.sql').read_text())
        fixture.rpc('iasdpi_schedule_save',['access',str(uuid.uuid4()),0,{'department_id':D,'user_id':base.L,'access_level':'manager','enabled':True},str(uuid.uuid4())])
        before={t:fixture.sql('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),\'[]\') from '+t+' x') for t in ['public.iasdpi_programs','public.iasdpi_activities','public.iasdpi_subactivities','public.culto_archives','public.iasdpi_templates','public.iasdpi_access','auth.users']}
        fixture.sql((base.ROOT/'database/013_access_governance.sql').read_text())
        self.assertEqual(fixture.sql('select count(*) from public.iasdpi_activities'),'16');self.assertEqual(fixture.sql('select count(*) from public.iasdpi_subactivities'),'1')
        for t,old in before.items():self.assertEqual(fixture.sql('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),\'[]\') from '+t+' x'),old,t)
        catalog=fixture.rpc('iasdpi_schedule_catalog',[],base.L);dept=next(d for d in catalog['departments'] if d['id']==D)
        self.assertTrue(dept['can_edit']);self.assertTrue(dept['can_publish']);self.assertTrue(dept['can_manage_members']);self.assertEqual(fixture.sql('select count(*) from iasdpi_admin_private.identity_states'),'0')
