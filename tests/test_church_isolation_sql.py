"""011 em PostgreSQL descartável --network none. Igrejas auxiliares só nos testes."""
import json
import unittest
import uuid
import test_user_management_sql as base
import test_operational_sql as operational

PI='1a5d0000-0000-4000-8000-000000000001'
OTHER='1a5d0000-0000-4000-8000-000000000002'
D='a0000000-0000-4000-8000-000000000001'

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class ChurchIsolationSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    sql=base.UserManagementSQLTests.sql
    quote=staticmethod(operational.OperationalSQLTests.quote)
    call=operational.OperationalSQLTests.call
    def command(self,source,actor=None,anonymous=False):
        header=json.dumps({'x-iasdpi-church':getattr(self,'church','IASD_PI')})
        if actor or anonymous:source="set local request.headers='%s'; %s"%(header,source)
        return base.UserManagementSQLTests.command(self,source,actor,anonymous)
    def setUp(self):
        self.church='IASD_PI';operational.OperationalSQLTests.setUp(self)
        for name in ['004_culto_trash.sql','005_schedule_foundation.sql','006_schedule_management.sql','007_daily_schedules.sql','008_monthly_rotation.sql','009_confirmed_schedule_conflicts.sql','010_simple_daily_schedules.sql']:self.sql((base.ROOT/'database'/name).read_text())
        self.p['actual_details'][self.parent]['subactivities']=[self.child]
        self.p['executions'][self.parent]['started']='2026-10-10T09:30:00.123456-03:00'
        self.saved=self.call()['document'];self.before=self.sql('select document::text from public.iasdpi_programs')
        self.sql((base.ROOT/'database/011_church_isolation.sql').read_text())
    def other(self,active=True):
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente banco descartável',%s,true); insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin');"%(OTHER,str(active).lower(),OTHER,base.B))
    def rpc(self,name,args,actor=base.A,fail=False):
        def literal(v):
            if isinstance(v,(dict,list)):return self.quote(json.dumps(v))+'::jsonb'
            if isinstance(v,bool):return str(v).lower()
            if isinstance(v,int):return str(v)
            return 'null' if v is None else self.quote(v)
        raw=self.sql('select public.'+name+'('+','.join(map(literal,args))+')',actor=actor,fail=fail)
        return None if fail or not raw else json.loads(raw)
    def test_backfill_preserves_all_old_payloads_ids_times_and_admin(self):
        self.assertEqual(self.sql('select document::text from public.iasdpi_programs'),self.before)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities'),'16');self.assertEqual(self.sql('select count(*) from public.iasdpi_subactivities'),'1')
        self.assertEqual(self.sql('select code from public.iasdpi_churches'),'IASD_PI')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_access where church_id=\'%s\' and user_id=\'%s\' and role=\'admin\' and enabled'%(PI,base.A)),'1')
        for table in ['iasdpi_programs','iasdpi_activities','iasdpi_subactivities','iasdpi_templates','iasdpi_access','schedule_departments']:
            self.assertEqual(self.sql('select count(*) from public.'+table+" where church_id<>'"+PI+"'"),'0')
        self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
    def test_public_selector_hides_inactive_unlisted_and_exposes_no_people(self):
        self.other(False);raw=self.sql('select row_to_json(c) from public.iasdpi_list_churches() c',anonymous=True)
        self.assertEqual(json.loads(raw)['code'],'IASD_PI');self.assertNotIn('email',raw)
        self.church='TEST_ONLY';self.sql('select public.iasdpi_current_church_id()',actor=base.B,fail=True)
        self.sql("update public.iasdpi_churches set active=true,listed=false where id='%s'"%OTHER)
        self.sql('select public.iasdpi_current_church_id()',actor=base.B,fail=True)
    def test_auth_memberships_and_rest_reads_are_scoped_even_with_forged_header(self):
        self.other();self.church='TEST_ONLY'
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.A),'0')
        self.sql('select * from public.iasdpi_list_users()',actor=base.A,fail=True)
        self.assertIn('admin2@example.invalid',self.sql('select email from public.iasdpi_list_users()',actor=base.B))
        self.assertNotIn('admin@example.invalid',self.sql('select email from public.iasdpi_list_users()',actor=base.B))
        self.assertEqual(self.sql('select count(*) from public.iasdpi_access',actor=base.B),'1')
        self.church='IASD_PI';self.assertEqual(self.sql('select count(*) from public.iasdpi_access',actor=base.B),'0')
    def test_rpc_update_trash_recovery_cannot_cross_church(self):
        self.other();self.church='TEST_ONLY'
        self.rpc('iasdpi_save_program',[self.saved['id'],1,{'id':self.saved['id'],'note':'Bloquear'},str(uuid.uuid4()),False],base.B,True)
        self.rpc('iasdpi_trash_program',[self.saved['id'],1,str(uuid.uuid4()),'Bloquear'],base.B,True)
        self.rpc('iasdpi_restore_program',[self.saved['id'],1,str(uuid.uuid4())],base.B,True)
        self.rpc('iasdpi_trash_detail',[self.saved['id']],base.B,True)
        self.assertEqual(self.sql('select document::text from public.iasdpi_programs'),self.before)
    def test_same_user_can_belong_to_two_churches_without_sharing_roles(self):
        self.other();self.sql("insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','leader')"%(OTHER,base.A))
        self.church='TEST_ONLY';self.sql('select * from public.iasdpi_list_users()',actor=base.A,fail=True)
        self.assertEqual(self.sql('select role from public.iasdpi_access',actor=base.A),'leader')
        self.church='IASD_PI';self.assertEqual(self.sql('select role from public.iasdpi_access',actor=base.A),'admin')
    def test_last_admin_is_protected_per_church_and_no_self_promotion(self):
        self.other();self.rpc('iasdpi_set_access',[base.A,'leader',True],fail=True)
        self.rpc('iasdpi_set_access',[base.L,'admin',True],actor=base.L,fail=True)
        self.church='TEST_ONLY';self.rpc('iasdpi_set_access',[base.A,'admin',True],actor=base.A,fail=True)
        self.rpc('iasdpi_set_access',[base.B,'leader',True],actor=base.B,fail=True)
    def test_template_keys_can_repeat_but_do_not_overwrite_other_church(self):
        self.other();before=self.sql("select plan::text from public.iasdpi_templates where id='free'")
        self.church='TEST_ONLY';result=self.rpc('iasdpi_save_template',['free',0,'Livre outra igreja',{'name':'Livre','items':[],'start':'','end':''}],actor=base.B)
        self.assertEqual(result['church_id'],OTHER)
        self.assertEqual(self.sql("select plan::text from public.iasdpi_templates where church_id='%s' and id='free'"%PI),before)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_templates where id='free'"),'2')
    def test_schedule_catalog_rpc_and_composite_fk_block_cross_church(self):
        self.other();self.church='TEST_ONLY';catalog=self.rpc('iasdpi_schedule_catalog',[],actor=base.B);self.assertEqual(catalog['departments'],[])
        dept=self.rpc('iasdpi_schedule_save',['department',str(uuid.uuid4()),0,{'code':'sonoplastia','name':'Sonoplastia'},str(uuid.uuid4())],actor=base.B)
        person=self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Pessoa descartável','display_name':'Pessoa descartável','department_id':dept['id']},str(uuid.uuid4())],actor=base.B)
        self.sql("insert into public.schedule_memberships(church_id,person_id,department_id) values('%s','%s','%s')"%(PI,person['id'],D),fail=True)
        self.church='IASD_PI';self.rpc('iasdpi_schedule_save',['person',person['id'],1,{'display_name':'Ataque'},str(uuid.uuid4())],fail=True)
        self.assertEqual(self.rpc('iasdpi_schedule_catalog',[])['people'],[])
    def test_non_bypass_executor_private_functions_and_direct_writes_denied(self):
        self.assertEqual(self.sql("select count(*) from pg_roles where rolname='iasdpi_church_executor' and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb)"),'0')
        for query in ["update public.iasdpi_access set role='admin'", "update public.iasdpi_programs set church_id='%s'"%OTHER, 'select iasdpi_operational_private.require_access()',"insert into public.iasdpi_churches(code,name) values('ATTACK','Ataque')"]:
            self.sql(query,actor=base.A,fail=True)
        self.assertEqual(self.sql("select pg_has_role('authenticated','iasdpi_church_executor','MEMBER')"),'f')
        self.sql('set session authorization authenticated;set role iasdpi_church_executor',fail=True)
        self.sql('select public.iasdpi_schedule_catalog()',anonymous=True,fail=True)
        self.sql('select * from public.iasdpi_list_users()',actor=base.L,fail=True)
        self.sql("update public.iasdpi_programs set church_id=null",fail=True)
    def test_managed_auth_rls_does_not_break_internal_identity_validation(self):
        self.sql('alter table auth.users enable row level security')
        self.assertIn('admin@example.invalid',self.sql('select email from public.iasdpi_list_users()',actor=base.A))
        self.rpc('iasdpi_schedule_catalog',[])
        self.sql('select * from iasdpi_admin_private.auth_accounts',actor=base.A,fail=True)
        self.assertEqual(self.sql("select has_table_privilege('iasdpi_church_executor','auth.users','SELECT')"),'f')
    def test_operational_save_after_migration_preserves_precision_and_versions(self):
        updated=self.call({'id':self.saved['id'],'note':'Editar na igreja correta'},version=1,actor=base.A)['document']
        self.assertEqual(updated['version'],2);self.assertEqual(updated['executions'],self.saved['executions'])
        self.assertEqual(updated['actual_details'],self.saved['actual_details']);self.assertEqual(len(updated['plan']['items']),16)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'1');self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.revisions'),'1')
    def test_invites_for_same_email_are_independent_and_wrong_church_token_is_denied(self):
        invite=json.loads(self.sql("select row_to_json(i) from public.iasdpi_create_invite('new@example.invalid') i",actor=base.A))
        self.other();self.church='TEST_ONLY';other=json.loads(self.sql("select row_to_json(i) from public.iasdpi_create_invite('new@example.invalid') i",actor=base.B))
        self.assertNotEqual(invite['token'],other['token'])
        self.rpc('iasdpi_accept_invite',[invite['token']],actor=base.U,fail=True)
        self.rpc('iasdpi_accept_invite',[other['token']],actor=base.U)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s' and church_id='%s'"%(base.U,PI)),'0')
        self.church='IASD_PI';self.rpc('iasdpi_accept_invite',[invite['token']],actor=base.U)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'2')
    def test_receipts_are_scoped_and_same_request_uuid_never_returns_other_church_payload(self):
        request=str(uuid.uuid4());one=self.rpc('iasdpi_save_program',[self.saved['id'],1,{'id':self.saved['id'],'note':'Somente PI'},request,False])
        self.other();self.church='TEST_ONLY';doc={**self.saved,'id':'discardable-other-church','note':'Somente outra igreja'}
        two=self.rpc('iasdpi_save_program',[doc['id'],0,doc,request,False],actor=base.B)
        self.assertEqual(two['document']['note'],'Somente outra igreja');self.assertNotEqual(one['document']['id'],two['document']['id'])
        self.assertEqual(self.sql("select count(*) from iasdpi_operational_private.receipts where request_id='%s'"%request),'2')

    def test_schedule_save_publish_and_versioned_partial_edit_after_isolation(self):
        person=self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Equipe descartável','display_name':'Equipe descartável','department_id':D},str(uuid.uuid4())])
        role=self.rpc('iasdpi_schedule_daily_role',[D])
        event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Culto de teste','date':'2031-01-01'},str(uuid.uuid4())])
        requirements=[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':1,'assignments':[{'id':str(uuid.uuid4()),'person_id':person['id']}]}]
        plan=self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':D,'month':'2031-01-01','title':'Escala de teste','requirements':requirements},str(uuid.uuid4())])
        published=self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())])
        self.assertEqual(published['status'],'published');self.assertEqual(published['church_id'],PI);self.assertEqual(published['requirements'][0]['assignments'][0]['person_id'],person['id'])
        self.assertEqual(self.rpc('iasdpi_schedule_workspace',[D,'2031-01-01'])['plan']['version'],2)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'title':'Antiga'},str(uuid.uuid4())],fail=True)
        self.assertEqual(self.sql('select count(*) from public.schedule_versions'),'2')

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class CoreChurchMigrationTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    # Usa helpers do teste anterior sem herdar seus cenários funcionais.
    def setUp(self):
        base.UserManagementSQLTests.setUp(self)
        for name in ['003_operational_storage.sql','004_culto_trash.sql']:self.sql((base.ROOT/'database'/name).read_text())
    def test_core_without_schedule_schema_installs_and_old_admin_is_preserved(self):
        self.sql((base.ROOT/'database/011_church_isolation.sql').read_text());self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
        self.assertIn('admin@example.invalid',self.sql('select email from public.iasdpi_list_users()',actor=base.A))
    def test_partial_schedule_installation_rolls_back_without_creating_churches(self):
        self.sql((base.ROOT/'database/005_schedule_foundation.sql').read_text());self.sql((base.ROOT/'database/011_church_isolation.sql').read_text(),fail=True)
        self.assertEqual(self.sql("select to_regclass('public.iasdpi_churches') is null"),'t')
        self.assertIn('admin@example.invalid',self.sql('select email from public.iasdpi_list_users()',actor=base.A))
