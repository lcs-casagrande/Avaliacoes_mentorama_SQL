"""024: Comunicação compatível e publicação parcial com permissões reais em PG isolado."""
import datetime,json,subprocess,unittest,uuid
import test_schedule_edit_window_sql as temporal
import test_user_management_sql as base
import test_g9_lifecycle_sql as g9
D=g9.D;M=g9.M
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class SchedulePublicationRulesSQLTests(unittest.TestCase):
 setUpClass=classmethod(temporal.ScheduleEditWindowSQLTests.setUpClass.__func__)
 sql=temporal.ScheduleEditWindowSQLTests.sql;command=temporal.ScheduleEditWindowSQLTests.command;rpc=temporal.ScheduleEditWindowSQLTests.rpc;quote=staticmethod(temporal.ScheduleEditWindowSQLTests.quote);grant=temporal.ScheduleEditWindowSQLTests.grant;snapshot=temporal.ScheduleEditWindowSQLTests.snapshot;service=temporal.ScheduleEditWindowSQLTests.service
 def setUp(self):
  temporal.ScheduleEditWindowSQLTests.setUp(self);self.sql((base.ROOT/'database/024_schedule_publication_rules.sql').read_text());self.communication=self.sql("select id from public.schedule_departments where code='comunicacao'")
  if not self.communication:self.communication=self.rpc('iasdpi_schedule_save',['department',str(uuid.uuid4()),0,{'code':'comunicacao','name':'Comunicação'},str(uuid.uuid4())])['id']
 def link(self,department):
  role=self.rpc('iasdpi_schedule_daily_role',[department]);version=int(self.sql("select version from public.schedule_people where id='%s'"%self.person));member=int(self.sql("select coalesce((select version from public.schedule_memberships where person_id='%s' and department_id='%s'),0)"%(self.person,department)))
  self.rpc('iasdpi_registry_save',[self.person,version,{},[{'department_id':department,'expected_version':member,'patch':{'participation_confirmed':True,'role_ids':[role['id']],'weekdays':{str(i):'available' for i in range(7)}}}],str(uuid.uuid4())]);return role
 def make(self,department=D,assigned=True,count=1,status='published'):
  role=self.link(department);event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':department,'title':'Atividade sintética 024','date':str(self.today)},str(uuid.uuid4())])
  return {'department_id':department,'month':str(self.first),'title':'Escala sintética 024','status':status,'requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':count,'notes':'','assignments':[{'id':str(uuid.uuid4()),'person_id':self.person,'timing_mode':'day'}] if assigned else []}]}
 def save(self,data,identity=None,version=0,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_plan_save',[identity or str(uuid.uuid4()),version,data,str(uuid.uuid4())],actor,fail)
 def visible(self,actor=base.A):return self.rpc('iasdpi_schedule_visible',[str(self.first)],actor)
 def public(self):return json.loads(self.sql("select public.iasdpi_schedule_published('%s')"%self.first,anonymous=True))
 def test_communication_then_sound_allowed_without_admin_exception(self):
  self.save(self.make(self.communication));self.save(self.make());self.assertEqual(self.sql('select count(*) from public.schedule_day_exceptions'),'0');self.assertEqual(len(self.visible()),2)
  ctx=self.rpc('iasdpi_schedule_rotation_context',[D,str(self.first)]);day=next(d for p in ctx['people'] if p['person_id']==self.person for d in p['days'] if d['date']==str(self.today));self.assertFalse(day['conflict'])
 def test_sound_then_communication_also_allowed(self):
  self.save(self.make());self.save(self.make(self.communication));self.assertEqual(len(self.visible()),2)
 def test_other_departments_still_block_even_when_communication_coexists(self):
  self.save(self.make(self.communication));self.save(self.make());self.save(self.make(M),fail=True);self.assertEqual(self.sql('select count(*) from public.schedule_plans'),'2')
 def test_publish_all_vacancies_visible_authorized_and_not_anonymous(self):
  p=self.save(self.make(assigned=False,count=2));self.assertEqual(p['status'],'published');visible=self.visible();self.assertEqual(len(visible),1);self.assertEqual(visible[0]['person'],'');self.assertTrue(visible[0]['pending']);self.assertEqual(visible[0]['vacancy_count'],2);self.assertEqual(self.public(),[])
 def test_partial_publication_includes_assigned_and_pending_without_duplication(self):
  self.save(self.make(count=2));rows=self.visible();self.assertEqual(len(rows),2);self.assertEqual(len({r['id'] for r in rows}),2);self.assertEqual(sum(1 for r in rows if r['person']),1);self.assertEqual(sum(r.get('vacancy_count',0) for r in rows),1)
 def test_private_revision_preserves_pending_publication_until_republished(self):
  p=self.save(self.make(assigned=False));data=self.make(status='draft');data['requirements'][0]['id']=p['requirements'][0]['id'];p2=self.save(data,p['id'],p['version']);self.assertEqual(self.visible()[0]['person'],'');p3=self.save({'status':'published'},p['id'],p2['version']);self.assertTrue(self.visible()[0]['person']);self.assertEqual(p3['version'],3)
 def test_empty_plan_still_blocked(self):
  self.save({'department_id':D,'month':str(self.first),'title':'Sem funções','status':'published','requirements':[]},fail=True)
 def test_missing_publisher_permission_still_blocks(self):
  self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':False});self.save(self.make(assigned=False),actor=base.U,fail=True)
 def test_closed_dates_still_blocked_and_cas_preserved(self):
  self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Data encerrada','date':str(self.today-datetime.timedelta(days=1))},str(uuid.uuid4())],fail=True)
  p=self.save(self.make(assigned=False));self.save({'title':'Revisão recente'},p['id'],p['version']);self.save({'title':'Revisão antiga'},p['id'],p['version'],fail=True)
 def test_elders_can_publish_real_unassigned_period_and_public_feed_shows_it(self):
  d=self.sql("select id from public.schedule_departments where code='ancionato'");end=self.sql("select ('%s'::date+interval '1 month - 1 day')::date"%self.first);row={'id':self.sql("select iasdpi_schedule_private.elder_id('%s','monthly','%s')"%(d,self.first)),'kind':'monthly','starts_on':str(self.first),'ends_on':end,'person_id':None,'expected_version':0}
  result=self.rpc('iasdpi_schedule_elder_save',[d,'published',[row],str(uuid.uuid4())]);self.assertIsNone(result['periods'][0]['person_id']);rows=self.public();self.assertEqual(len(rows),1);self.assertTrue(rows[0]['pending']);self.assertEqual(rows[0]['person'],'')
 def test_communication_does_not_block_weekly_elder(self):
  self.save(self.make(self.communication));d=self.sql("select id from public.schedule_departments where code='ancionato'");self.link(d);first=self.today-datetime.timedelta(days=(self.today.weekday()+1)%7);row={'id':self.sql("select iasdpi_schedule_private.elder_id('%s','weekly','%s')"%(d,first)),'kind':'weekly','starts_on':str(first),'ends_on':str(first+datetime.timedelta(days=6)),'person_id':self.person,'expected_version':0};self.rpc('iasdpi_schedule_elder_save',[d,'published',[row],str(uuid.uuid4())])
 def test_rollback_empty_preserves_data_and_populated_history_refuses(self):
  before=self.snapshot()['core_fingerprints'];self.sql((base.ROOT/'database/024_schedule_publication_rules_down.sql').read_text());self.assertEqual(before,self.snapshot()['core_fingerprints']);self.assertNotIn('allow_pending_publication',self.rpc('iasdpi_schedule_settings_get',[]));self.sql((base.ROOT/'database/024_schedule_publication_rules.sql').read_text());p=self.save(self.make(assigned=False));self.save({'status':'draft'},p['id'],p['version']);self.sql((base.ROOT/'database/024_schedule_publication_rules_down.sql').read_text(),fail=True);self.assertEqual(len(self.visible()),1)
 def test_concurrent_communication_and_sound_both_succeed(self):
  records=[self.make(self.communication),self.make(D)];jobs=[]
  for data in records:
   query='select public.iasdpi_schedule_plan_save('+self.quote(str(uuid.uuid4()))+',0,'+self.quote(json.dumps(data))+','+self.quote(str(uuid.uuid4()))+')';p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;jobs.append(p)
  output=[p.communicate(timeout=30) for p in jobs];self.assertTrue(all(p.returncode==0 for p in jobs),output)
 def test_security_and_privacy_postinstall_checks(self):
  self.assertTrue(self.rpc('iasdpi_schedule_settings_get',[])['allow_pending_publication']);self.assertEqual(self.sql((base.ROOT/'database/check_schedule_publication_rules.sql').read_text()),'')
