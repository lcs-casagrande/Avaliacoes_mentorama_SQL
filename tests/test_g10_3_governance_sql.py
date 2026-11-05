"""G10.3: responsabilidades confirmadas, aprovação, auditoria e senha no PG isolado."""
import json,unittest,uuid
import test_event_direct_publication_sql as e25
import test_event_planning_sql as events
import test_user_management_sql as base
import test_g9_lifecycle_sql as g9
D=g9.D;M=g9.M
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class G103GovernanceSQLTests(unittest.TestCase):
 setUpClass=classmethod(e25.EventDirectPublicationSQLTests.setUpClass.__func__)
 sql=events.EventPlanningSQLTests.sql;command=events.EventPlanningSQLTests.command;quote=staticmethod(events.EventPlanningSQLTests.quote);rpc=events.EventPlanningSQLTests.rpc;grant=events.EventPlanningSQLTests.grant;public=events.EventPlanningSQLTests.public;snapshot=events.EventPlanningSQLTests.snapshot;service=events.EventPlanningSQLTests.service
 install=e25.EventDirectPublicationSQLTests.install
 data=events.EventPlanningSQLTests.data;event=events.EventPlanningSQLTests.event;series=events.EventPlanningSQLTests.series
 def setUp(self):
  e25.EventDirectPublicationSQLTests.setUp(self);self.before=self.snapshot()['core_fingerprints'];self.sql((base.ROOT/'database/026_governance_responsibilities.sql').read_text());self.elder=self.sql("select id from public.schedule_departments where code='ancionato'")
 def link(self,user=base.U,department=D,head=False):
  found=self.sql("select id from public.schedule_people where auth_user_id='%s'"%user)
  if found:
   p=found;role=self.rpc('iasdpi_schedule_daily_role',[department]);version=int(self.sql("select version from public.schedule_people where id='%s'"%p));self.rpc('iasdpi_registry_save',[p,version,{},[{'department_id':department,'expected_version':0,'patch':{'role_ids':[role['id']],'participation_confirmed':True}}],str(uuid.uuid4())])
  else:
   p=g9.G9LifecycleSQLTests.person(self,'Pessoa sintética individual '+user[:8],(department,));self.sql("update public.schedule_people set auth_user_id='%s' where id='%s'"%(user,p))
  self.sql("update public.schedule_memberships set is_ministry_head=%s where person_id='%s' and department_id='%s'"%('true' if head else 'false',p,department));return self.sql("select id from public.schedule_memberships where person_id='%s' and department_id='%s'"%(p,department))
 def confirm(self,user=base.U,department=D,kind='leader',approve=False,version=0,member=None,actor=base.A,fail=False):
  return self.rpc('iasdpi_responsibility_access_save',[department,user,member or self.link(user,department,kind=='leader'),kind,approve,version,'Responsabilidade confirmada presencialmente'],actor,fail)
 def leader(self):return self.confirm()
 def authorized_elder(self):return self.confirm(base.V,self.elder,'elder',True)
 def create(self,actor=base.U,**patch):return self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(**patch),str(uuid.uuid4()),False],actor)['event']
 def test_installation_preserves_core_and_creates_no_auth_accounts(self):
  self.assertEqual(self.before,self.snapshot()['core_fingerprints']);self.assertEqual(self.sql('select count(*) from auth.users'),'7');self.assertEqual(self.rpc('iasdpi_responsibility_account_plan',[]),[])
 def test_member_and_leadership_label_alone_do_not_grant_edit(self):
  self.link(head=True);self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(),str(uuid.uuid4()),False],base.U,True);self.assertEqual(self.sql('select count(*) from public.schedule_department_access'),'0')
 def test_confirmed_leader_publishes_only_own_department(self):
  self.leader();e=self.create();self.assertEqual(e['status'],'published');self.assertEqual(e['approval_status'],'not_required');self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(department_id=M,organizer_department_id=M),str(uuid.uuid4()),False],base.U,True)
 def test_general_church_event_requests_approval_and_is_hidden(self):
  self.leader();e=self.create(category='church',department_id=None,program_category='general',organizer_kind='local_church',organizer_department_id=None);self.assertEqual((e['status'],e['approval_status']),('draft','pending'));self.assertEqual(self.public(e['date'][:7]+'-01')['events'],[]);self.assertIn(e['id'],[r['id'] for r in self.rpc('iasdpi_events_catalog',[],base.U)['events']])
 def test_department_organizer_general_program_also_needs_approval(self):
  self.leader();e=self.create(program_category='general');self.assertEqual(e['status'],'draft');self.assertEqual(e['approval_status'],'pending')
 def test_authorized_elder_approves_other_department_without_gaining_edit(self):
  self.leader();e=self.create(program_category='general');self.authorized_elder();self.rpc('iasdpi_event_submit',[e['id'],1,{'title':'Mudança fora do alcance'},str(uuid.uuid4()),False],base.V,True)
  p=self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())],base.V);self.assertEqual((p['status'],p['approval_status']),('published','approved'));self.assertEqual(p['id'],e['id']);self.assertEqual(self.public(e['date'][:7]+'-01')['events'][0]['id'],e['id'])
 def test_leader_and_non_authorized_elder_cannot_approve(self):
  self.leader();e=self.create(program_category='general');self.confirm(base.V,self.elder,'elder',False)
  for u in [base.U,base.V]:self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())],u,True)
 def test_administrator_can_approve_and_retry_is_idempotent(self):
  self.leader();e=self.create(program_category='general');r=str(uuid.uuid4());a=self.rpc('iasdpi_event_approve',[e['id'],1,r]);b=self.rpc('iasdpi_event_approve',[e['id'],1,r]);self.assertEqual(a,b);self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),2)
 def test_approval_revalidates_version_and_exclusive_reservations(self):
  self.leader();e=self.create(program_category='general');self.event(title='Reserva concorrente confirmada');self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())],fail=True);self.assertEqual(self.sql("select status from public.iasdpi_events where id='%s'"%e['id']),'draft')
 def test_access_delegations_do_not_allow_nonadmin_grants_or_audit(self):
  self.grant(flags={'view':True,'edit':True,'access':True,'requests':True,'members':True})
  for name,args in [('iasdpi_department_access_save',[D,base.V,{'view':True},'active',0]),('iasdpi_governance_catalog',[]),('iasdpi_governance_history',[0]),('iasdpi_identity_state_save',[base.V,'suspended','Tentativa não autorizada'])]:self.rpc(name,args,base.U,True)
 def test_one_person_has_multiple_departments_and_central_id(self):
  a=self.leader();member=self.link(base.U,M,True);b=self.confirm(base.U,M,member=member);self.assertNotEqual(a['id'],b['id']);self.assertEqual(self.sql("select count(*) from public.schedule_people where auth_user_id='%s'"%base.U),'1');self.assertEqual(self.create(department_id=M,organizer_department_id=M)['status'],'published')
 def test_responsibility_removal_invalidates_permissions(self):
  a=self.leader();self.sql("update public.schedule_memberships set active=false where id='%s'"%a['responsibility_membership_id']);self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(),str(uuid.uuid4()),False],base.U,True)
 def test_audit_is_admin_only_and_never_returns_freeform_secrets(self):
  self.leader();e=self.create(program_category='general',description='SYNTHETIC_SECRET_DO_NOT_SHOW');self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())]);self.sql("insert into iasdpi_admin_private.audit(actor_id,action,details) values('%s','legacy_note','{\"password\":\"SYNTHETIC_SECRET_DO_NOT_SHOW\",\"token\":\"private-token\"}')"%base.A)
  rows=self.rpc('iasdpi_governance_history',[0]);self.assertNotIn('SYNTHETIC_SECRET_DO_NOT_SHOW',json.dumps(rows));self.assertNotIn('private-token',json.dumps(rows));self.assertTrue(any(r['action']=='event_approved_and_published' for r in rows));self.assertTrue(any(r['details'].get('before') and r['details'].get('after') for r in rows));self.rpc('iasdpi_governance_history',[0],base.U,True)
 def test_temporary_password_blocks_data_until_secure_confirmation(self):
  self.leader();self.rpc('iasdpi_require_password_change',[base.U,'Credencial provisória de conta individual']);self.assertTrue(self.rpc('iasdpi_password_change_context',[],base.U)['must_change_password']);self.rpc('iasdpi_schedule_catalog',[],base.U,True);self.rpc('iasdpi_password_change_confirm',[base.U],base.U,True);self.service('iasdpi_password_change_confirm',[base.U]);self.rpc('iasdpi_schedule_catalog',[],base.U,True);self.iat=int(self.sql('select extract(epoch from now())::bigint'))+3;self.assertFalse(self.rpc('iasdpi_password_change_context',[],base.U)['must_change_password']);self.rpc('iasdpi_schedule_catalog',[],base.U)
 def test_last_admin_still_protected_and_crono_core_compatible(self):
  self.rpc('iasdpi_set_access',[base.A,'leader',True],fail=True);self.assertEqual(self.before,self.snapshot()['core_fingerprints'])
 def test_elder_multiple_departments_and_anchor_revocation(self):
  a=self.authorized_elder();member=self.link(base.V,D);self.confirm(base.V,D,'elder',False,member=member);self.assertEqual(self.create(base.V)['status'],'published');self.grant(user=base.V,dept=self.elder,status='revoked',version=a['version']);self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(),str(uuid.uuid4()),False],base.V,True)
 def test_general_revision_waits_again_and_keeps_prior_publication(self):
  self.leader();e=self.create(program_category='general');p=self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())]);draft=self.rpc('iasdpi_event_submit',[e['id'],p['version'],{'title':'Revisão aguardando decisão','status':'published'},str(uuid.uuid4()),False],base.U)['event'];self.assertEqual(draft['approval_status'],'pending');self.assertNotEqual(self.public(e['date'][:7]+'-01')['events'][0]['title'],'Revisão aguardando decisão')
 def test_general_series_can_be_submitted_and_occurrence_approved(self):
  self.leader();r=self.rpc('iasdpi_event_series_save',[str(uuid.uuid4()),0,self.data(program_category='general',spaces=['salas'],recurrence='weekly',recurrence_weekday=6),str(uuid.uuid4()),'all',None,False],base.U);self.assertEqual(r['series']['approval_status'],'pending');self.assertTrue(all(e['status']=='draft' for e in r['events']));self.rpc('iasdpi_event_approve',[r['events'][0]['id'],1,str(uuid.uuid4())]);self.assertEqual(len(self.public(r['events'][0]['date'][:7]+'-01')['events']),1)
 def test_password_barrier_covers_direct_rest_and_private_helpers(self):
  self.leader();self.rpc('iasdpi_require_password_change',[base.U,'Credencial provisória de conta individual']);self.sql('select count(*) from public.schedule_people',actor=base.U,fail=True);self.sql('select iasdpi_admin_private.session_allowed_before_026()',actor=base.U,fail=True);self.assertGreater(int(self.sql('select count(*) from public.iasdpi_templates',actor=base.L)),0);self.rpc('iasdpi_require_password_change',[base.L,'Credencial provisória em conta operacional']);self.assertEqual(self.sql('select count(*) from public.iasdpi_templates',actor=base.L),'0')
 def test_new_permissions_checks_and_foreign_church_are_enforced(self):
  self.assertEqual(self.sql((base.ROOT/'database/check_governance_responsibilities.sql').read_text()),'');self.church='OTHER_NOT_AUTHORIZED';self.rpc('iasdpi_governance_history',[0],base.A,True);self.rpc('iasdpi_responsibility_account_plan',[],base.A,True)
 def test_competing_approvals_only_one_commits(self):
  import subprocess
  self.leader();e=self.create(program_category='general');jobs=[]
  for _ in range(2):
   query="select public.iasdpi_event_approve('%s',1,'%s')"%(e['id'],uuid.uuid4());p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;jobs.append(p)
  outputs=[p.communicate(timeout=30) for p in jobs];self.assertEqual(sum(p.returncode==0 for p in jobs),1,outputs);self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),2)
 def test_administrator_links_existing_auth_through_existing_registry_editor_rpc(self):
  person=g9.G9LifecycleSQLTests.person(self,'Pessoa sintética para identidade',(D,));version=int(self.sql("select version from public.schedule_people where id='%s'"%person));self.rpc('iasdpi_schedule_save',['person',person,version,{'auth_user_id':base.U},str(uuid.uuid4())]);self.assertEqual(self.sql("select auth_user_id from public.schedule_people where id='%s'"%person),base.U);self.assertEqual(self.sql('select count(*) from auth.users'),'7')
 def test_account_plan_keeps_one_person_and_flags_existing_alias_collision(self):
  self.leader();self.link(base.U,M,True);p=self.rpc('iasdpi_responsibility_account_plan',[])[0];self.assertEqual(len(p['departments']),2);self.assertEqual(p['auth_user_id'],base.U);self.rpc('iasdpi_alias_save',[p['suggested_alias'],base.A,True,0,'Apelido existente de outra identidade']);p2=self.rpc('iasdpi_responsibility_account_plan',[])[0];self.assertTrue(p2['alias_requires_review']);self.assertEqual(p2['person_id'],p['person_id'])
 def test_confirmed_leader_can_save_and_publish_own_schedule(self):
  self.leader();person=self.sql("select id from public.schedule_people where auth_user_id='%s'"%base.U);role=self.rpc('iasdpi_schedule_daily_role',[D],base.U);event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'date':str(self.today),'title':'Culto sintético para gestão'},str(uuid.uuid4())],base.U)
  data={'department_id':D,'month':str(self.first),'title':'Escala sintética de responsabilidade','status':'published','requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':1,'notes':'','assignments':[{'id':str(uuid.uuid4()),'person_id':person,'timing_mode':'day'}]}]};p=self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,data,str(uuid.uuid4())],base.U);self.assertEqual(p['status'],'published');self.assertTrue(self.rpc('iasdpi_schedule_visible',[str(self.first)],base.U));self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':M,'date':str(self.today),'title':'Tentativa em outro departamento'},str(uuid.uuid4())],base.U,True)
 def test_elder_publishes_week_and_month_independently_without_becoming_core_admin(self):
  import datetime
  self.authorized_elder();person=self.sql("select id from public.schedule_people where auth_user_id='%s'"%base.V);week=self.today-datetime.timedelta(days=(self.today.weekday()+1)%7);last=self.sql("select ('%s'::date+interval '1 month - 1 day')::date"%self.first)
  for kind,start,end in [('weekly',week,str(week+datetime.timedelta(days=6))),('monthly',self.first,last)]:
   identity=self.sql("select iasdpi_schedule_private.elder_id('%s','%s','%s')"%(self.elder,kind,start));r=self.rpc('iasdpi_schedule_elder_save',[self.elder,'published',[{'id':identity,'kind':kind,'starts_on':str(start),'ends_on':end,'person_id':person,'expected_version':0}],str(uuid.uuid4())],base.V);self.assertEqual(r['periods'][0]['status'],'published')
  self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.V),'0');self.assertEqual({r['kind'] for r in self.public_schedule_rows()}, {'weekly','monthly'})
 def public_schedule_rows(self):return json.loads(self.sql("select public.iasdpi_schedule_published('%s')"%self.first,anonymous=True))
 def test_other_leader_cannot_read_general_draft_history_or_private_series_definition(self):
  self.leader();self.confirm(base.V,M);e=self.create(program_category='general',category='church',department_id=None,organizer_kind='local_church',organizer_department_id=None,description='SYNTHETIC_OTHER_GENERAL_PRIVATE');self.rpc('iasdpi_event_history',[e['id']],base.V,True)
  self.rpc('iasdpi_event_series_save',[str(uuid.uuid4()),0,self.data(program_category='general',category='church',department_id=None,organizer_kind='local_church',organizer_department_id=None,spaces=['salas'],recurrence='weekly',recurrence_weekday=6,description='SYNTHETIC_OTHER_GENERAL_PRIVATE'),str(uuid.uuid4()),'all',None,False],base.U)
  self.assertNotIn('SYNTHETIC_OTHER_GENERAL_PRIVATE',json.dumps(self.rpc('iasdpi_events_catalog',[],base.V)))
 def test_conflict_preview_does_not_leak_other_general_unsubmitted_revision_title(self):
  self.leader();e=self.event(title='Título geral público',program_category='general',category='church',department_id=None,organizer_kind='local_church',organizer_department_id=None);self.rpc('iasdpi_event_submit',[e['id'],e['version'],{'title':'SYNTHETIC_UNSUBMITTED_PRIVATE_TITLE','status':'draft'},str(uuid.uuid4()),False]);result=self.rpc('iasdpi_event_preview',[self.data()],base.U);text=json.dumps(result,ensure_ascii=False);self.assertNotIn('SYNTHETIC_UNSUBMITTED_PRIVATE_TITLE',text);self.assertIn('Título geral público',text)
 def test_approver_can_decide_general_church_event_without_editing_its_author_content(self):
  self.leader();e=self.create(program_category='general',category='church',department_id=None,organizer_kind='local_church',organizer_department_id=None);self.authorized_elder();self.rpc('iasdpi_event_submit',[e['id'],1,{'title':'Edição indevida pelo aprovador'},str(uuid.uuid4()),False],base.V,True);p=self.rpc('iasdpi_event_approve',[e['id'],1,str(uuid.uuid4())],base.V);self.assertEqual(p['status'],'published');self.assertEqual(p['title'],e['title'])
