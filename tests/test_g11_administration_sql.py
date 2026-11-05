"""G11: governança final em PostgreSQL descartável; nunca Supabase real."""
import subprocess,unittest,uuid
import test_g10_3_governance_sql as old
import test_g9_lifecycle_sql as g9
import test_user_management_sql as base

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class G11AdministrationSQLTests(unittest.TestCase):
 setUpClass=classmethod(old.G103GovernanceSQLTests.setUpClass.__func__)
 sql=old.G103GovernanceSQLTests.sql;command=old.G103GovernanceSQLTests.command;quote=staticmethod(old.G103GovernanceSQLTests.quote)
 rpc=old.G103GovernanceSQLTests.rpc;grant=old.G103GovernanceSQLTests.grant;service=old.G103GovernanceSQLTests.service
 snapshot=old.G103GovernanceSQLTests.snapshot;install=old.G103GovernanceSQLTests.install;data=old.G103GovernanceSQLTests.data
 public=old.G103GovernanceSQLTests.public;link=old.G103GovernanceSQLTests.link;confirm=old.G103GovernanceSQLTests.confirm
 leader=old.G103GovernanceSQLTests.leader;authorized_elder=old.G103GovernanceSQLTests.authorized_elder;create=old.G103GovernanceSQLTests.create
 def setUp(self):
  old.G103GovernanceSQLTests.setUp(self);self.sql((base.ROOT/'database/027_governance_administration.sql').read_text())
 def make_person(self,name='Pessoa sintética G11'):return g9.G9LifecycleSQLTests.person(self,name,(g9.D,g9.M))
 def pversion(self,p):return int(self.sql("select version from public.schedule_people where id='%s'"%p))
 def test_installation_catalog_and_admin_only_no_accounts_created(self):
  self.assertEqual(self.sql('select count(*) from auth.users'),'7');c=self.rpc('iasdpi_governance_catalog',[]);self.assertEqual(c['administration_version'],11);self.assertTrue(all(p['auth_user_id'] is None for p in c['people']))
  self.rpc('iasdpi_governance_catalog',[],base.L,True);self.sql('select * from iasdpi_admin_private.account_creation_requests',anonymous=True,fail=True)
  self.assertEqual(self.snapshot()['core_fingerprints'],self.before);self.assertEqual(self.sql((base.ROOT/'database/check_g11_administration.sql').read_text()),'')
 def test_create_intent_finish_alias_and_first_password_without_grants(self):
  person=self.make_person();request=str(uuid.uuid4());user=str(uuid.uuid4());version=int(self.sql("select version from public.schedule_people where id='%s'"%person))
  args=[request,person,version,'individual.g11','g11@example.invalid'];self.assertFalse(self.rpc('iasdpi_account_create_begin',args)['completed'])
  self.assertEqual(self.sql('select count(*) from auth.users'),'7')
  self.sql("insert into auth.users values('%s','g11@example.invalid',now(),false)"%user)
  result=self.rpc('iasdpi_account_create_finish',[request,user]);self.assertTrue(result['completed']);self.assertEqual(self.rpc('iasdpi_account_create_finish',[request,user]),result)
  self.assertEqual(self.sql("select auth_user_id from public.schedule_people where id='%s'"%person),user)
  self.assertEqual(self.sql("select must_change_password from iasdpi_governance_private.identity_epochs where user_id='%s'"%user),'t')
  self.assertEqual(self.sql("select count(*) from public.schedule_department_access where user_id='%s'"%user),'0')
  self.assertEqual(self.service('iasdpi_alias_login_lookup',['individual.g11'])['user_id'],user)
  c=self.rpc('iasdpi_governance_catalog',[]);row=next(x for x in c['users'] if x['user_id']==user);self.assertTrue(row['must_change_password']);self.assertIsNone(row['last_sign_in_at'])
 def test_link_reuse_state_and_last_admin_protection(self):
  p=self.make_person();v=int(self.sql("select version from public.schedule_people where id='%s'"%p));self.rpc('iasdpi_account_link',[p,v,base.U]);self.assertEqual(self.sql('select count(*) from auth.users'),'7')
  other=self.make_person('Outra pessoa sintética');self.rpc('iasdpi_account_link',[other,2,base.U],fail=True)
  self.rpc('iasdpi_account_state_save',[base.U,'suspended','Identidade suspensa administrativamente']);self.assertFalse(self.sql("select iasdpi_admin_private.alias_identity_allowed('%s')"%base.U)=='t')
  self.rpc('iasdpi_account_state_save',[base.A,'revoked','Tentativa de remover último administrador'],fail=True)
 def test_confirmed_profiles_multiple_departments_and_manual_member(self):
  self.leader();member=self.sql("select id from public.schedule_people where auth_user_id='%s'"%base.U)
  acl=self.rpc('iasdpi_governance_catalog',[])['access'][0]
  result=self.rpc('iasdpi_governance_permission_save',[g9.D,base.U,'leader',{'view':True,'edit':True,'publish':True,'members':True},'active',acl['version'],False]);self.assertEqual(result['responsibility_kind'],'leader');self.assertTrue(result['can_manage_members'])
  self.link(base.U,g9.M,True);second=self.rpc('iasdpi_governance_permission_save',[g9.M,base.U,'leader',{'view':True,'edit':True,'publish':True},'active',0,False])
  self.assertEqual(len(self.rpc('iasdpi_portal_context',[],base.U)['departments']),2)
  self.rpc('iasdpi_governance_permission_save',[g9.M,base.U,'manual',{'view':True,'edit':False,'publish':False},'active',second['version'],False])
  self.rpc('iasdpi_governance_permission_save',[g9.D,base.U,'leader',{'view':True},'active',result['version'],False],base.U,True)
 def test_general_rejection_authorization_history_retry_and_no_public_draft(self):
  self.leader();event=self.create(program_category='general');request=str(uuid.uuid4());self.authorized_elder()
  self.rpc('iasdpi_event_reject',[event['id'],event['version'],'Data precisa ser revisada',request],base.U,True)
  result=self.rpc('iasdpi_event_reject',[event['id'],event['version'],'Data precisa ser revisada',request],base.V)
  self.assertEqual(result['approval_status'],'rejected');self.assertEqual(result['status'],'draft')
  self.assertEqual(self.rpc('iasdpi_event_reject',[event['id'],event['version'],'Data precisa ser revisada',request],base.V),result)
  self.assertNotIn(event['id'],[x['id'] for x in self.public(event['date'][:7]+'-01')['events']]);self.assertTrue(any(x['action']=='event_rejected' for x in self.rpc('iasdpi_governance_history',[0])))
 def test_pending_creation_can_be_cancelled_without_deleting_auth_or_history(self):
  person=self.make_person();request=str(uuid.uuid4());self.rpc('iasdpi_account_create_begin',[request,person,self.pversion(person),'pending.g11','pending@example.invalid'])
  self.rpc('iasdpi_account_creation_cancel',[request],base.L,True);self.rpc('iasdpi_account_creation_cancel',[request])
  self.assertEqual(self.sql("select status from iasdpi_admin_private.account_creation_requests where id='%s'"%request),'cancelled')
  self.assertEqual(self.sql('select count(*) from auth.users'),'7');self.rpc('iasdpi_account_create_begin',[str(uuid.uuid4()),person,self.pversion(person),'pending.g11','pending@example.invalid'])
 def test_alias_claimed_during_creation_keeps_person_unlinked_on_failure(self):
  person=self.make_person();request=str(uuid.uuid4());user=str(uuid.uuid4());self.rpc('iasdpi_account_create_begin',[request,person,self.pversion(person),'collision.g11','collision@example.invalid'])
  self.rpc('iasdpi_alias_save',['collision.g11',base.L,True,0,'Vínculo simultâneo de outro administrador'])
  self.sql("insert into auth.users values('%s','collision@example.invalid',now(),false)"%user);self.rpc('iasdpi_account_create_finish',[request,user],fail=True)
  self.assertEqual(self.sql("select auth_user_id is null from public.schedule_people where id='%s'"%person),'t')
  self.assertEqual(self.sql("select count(*) from public.schedule_department_access where user_id='%s'"%user),'0')
 def test_concurrent_account_intents_have_one_winner(self):
  person=self.make_person();processes=[]
  for i in range(2):
   query="select public.iasdpi_account_create_begin('%s','%s',%s,'concurrent.g11','concurrent@example.invalid')"%(uuid.uuid4(),person,self.pversion(person))
   proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);proc.stdin.write(self.command(query,base.A));proc.stdin.close();proc.stdin=None;processes.append(proc)
  outputs=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs)
  self.assertEqual(self.sql('select count(*) from iasdpi_admin_private.account_creation_requests'),'1');self.assertEqual(self.sql('select count(*) from auth.users'),'7')
 def test_cancelled_intent_cannot_finish_after_auth_response(self):
  person=self.make_person();request=str(uuid.uuid4());user=str(uuid.uuid4());self.rpc('iasdpi_account_create_begin',[request,person,self.pversion(person),'cancelled.g11','cancelled@example.invalid']);self.rpc('iasdpi_account_creation_cancel',[request])
  self.sql("insert into auth.users values('%s','cancelled@example.invalid',now(),false)"%user);self.rpc('iasdpi_account_create_finish',[request,user],fail=True)
  self.assertEqual(self.sql("select auth_user_id is null from public.schedule_people where id='%s'"%person),'t')

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class G11GovernanceRegressionSQLTests(old.G103GovernanceSQLTests):
 def setUp(self):
  super().setUp();self.sql((base.ROOT/'database/027_governance_administration.sql').read_text())
