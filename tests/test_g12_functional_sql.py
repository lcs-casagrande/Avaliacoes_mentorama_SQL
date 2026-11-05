"""G12: jornadas compostas e regressão após 027 apenas em PostgreSQL sem rede."""
import json,unittest,uuid
import test_g11_administration_sql as g11
import test_existing_supabase_flows_sql as flows
import test_g9_lifecycle_sql as lifecycle
import test_user_management_sql as base

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G12FunctionalSQLTests(g11.G11AdministrationSQLTests):
 def test_onboarding_individual_multi_ministry_draft_publication_and_revocation(self):
  p=self.make_person('Pessoa sintética G12');user=str(uuid.uuid4());request=str(uuid.uuid4())
  self.rpc('iasdpi_account_create_begin',[request,p,self.pversion(p),'individual.g12','individual-g12@example.invalid'])
  self.sql("insert into auth.users values('%s','individual-g12@example.invalid',now(),false)"%user)
  self.rpc('iasdpi_account_create_finish',[request,user]);self.assertEqual(self.service('iasdpi_alias_login_lookup',['individual.g12'])['user_id'],user)
  self.rpc('iasdpi_schedule_catalog',[],user,True);self.service('iasdpi_password_change_confirm',[user]);self.iat=int(self.sql('select extract(epoch from now())::bigint'))+3
  for dep in [lifecycle.D,lifecycle.M]:self.rpc('iasdpi_governance_permission_save',[dep,user,'manual',{'view':True,'edit':True,'publish':True},'active',0,False])
  self.assertEqual({d['id'] for d in self.rpc('iasdpi_portal_context',[],user)['departments']},{lifecycle.D,lifecycle.M})
  plan=lifecycle.G9LifecycleSQLTests.plan(self,p,day=str(self.today));published=self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())],user)
  self.assertEqual(published['status'],'published');self.assertTrue(self.rpc('iasdpi_schedule_visible',[str(self.first)],user))
  self.rpc('iasdpi_governance_permission_save',[lifecycle.D,user,'manual',{'view':True,'edit':True,'publish':True},'suspended',1,False])
  self.assertEqual({d['id'] for d in self.rpc('iasdpi_portal_context',[],user)['departments']},{lifecycle.M})
  self.rpc('iasdpi_schedule_plan_save',[plan['id'],published['version'],{'title':'Tentativa após suspensão'},str(uuid.uuid4())],user,True)
  self.rpc('iasdpi_account_state_save',[user,'suspended','Suspensão integral sintética G12']);self.rpc('iasdpi_portal_context',[],user,True)
  rows=self.rpc('iasdpi_governance_history',[0]);self.assertTrue(any(r['action']=='account_created' for r in rows));self.assertTrue(any(r['details'].get('entity')=='schedule' for r in rows));self.assertEqual(self.snapshot()['core_fingerprints'],self.before)
 def test_elder_revocation_prevents_pending_general_decision(self):
  self.leader();event=self.create(program_category='general');self.authorized_elder()
  acl=next(row for row in self.rpc('iasdpi_governance_catalog',[])['access'] if row['user_id']==base.V)
  self.rpc('iasdpi_governance_permission_save',[self.elder,base.V,'elder',{'view':True,'edit':True,'publish':True},'revoked',acl['version'],False])
  self.rpc('iasdpi_event_approve',[event['id'],event['version'],str(uuid.uuid4())],base.V,True)
  self.rpc('iasdpi_event_reject',[event['id'],event['version'],'Decisão após revogação',str(uuid.uuid4())],base.V,True)
  self.assertFalse(any(row['id']==event['id'] for row in self.public(event['date'][:7]+'-01')['events']))
  self.assertEqual(self.snapshot()['core_fingerprints'],self.before)

for _name in dir(g11.G11AdministrationSQLTests):
 if _name.startswith('test_') and _name not in G12FunctionalSQLTests.__dict__:
  setattr(G12FunctionalSQLTests,_name,None)

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G12ExistingFlowsAfter027SQLTests(flows.ExistingSupabaseFlowsSQLTests):
 def setUp(self):
  super().setUp();self.sql((base.ROOT/'database/027_governance_administration.sql').read_text())
