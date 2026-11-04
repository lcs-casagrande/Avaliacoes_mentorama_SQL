"""023: dias encerrados, mês atual/futuro, RLS e concorrência em PG descartável."""
import copy,datetime,json,subprocess,unittest,uuid
import test_event_planning_sql as e22
import test_user_management_sql as base
import test_g9_lifecycle_sql as g9
D=g9.D;M=g9.M
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class ScheduleEditWindowSQLTests(unittest.TestCase):
 setUpClass=classmethod(e22.EventPlanningSQLTests.setUpClass.__func__)
 sql=e22.EventPlanningSQLTests.sql;command=e22.EventPlanningSQLTests.command;rpc=e22.EventPlanningSQLTests.rpc;quote=staticmethod(e22.EventPlanningSQLTests.quote);grant=e22.EventPlanningSQLTests.grant
 snapshot=e22.EventPlanningSQLTests.snapshot;service=e22.EventPlanningSQLTests.service
 def setUp(self):
  e22.EventPlanningSQLTests.setUp(self)
  self.today=datetime.date.fromisoformat(self.sql("select (clock_timestamp() at time zone 'America/Sao_Paulo')::date"));self.first=self.today.replace(day=1)
  self.person=g9.G9LifecycleSQLTests.person(self,'Pessoa sintética temporal')
  self.sql((base.ROOT/'database/023_schedule_edit_window.sql').read_text())
 def prepare(self,month=None,dept=D,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_prepare_month',[dept,str(month or self.first),str(uuid.uuid4()),'Culto fictício temporal'],actor,fail)
 def plan(self,events=None,person=True):
  events=events or self.prepare()['events'];r=self.rpc('iasdpi_schedule_daily_role',[D]);return {'department_id':D,'month':str(self.first),'title':'Plano fictício temporal','status':'draft','requirements':[{'id':str(uuid.uuid4()),'event_id':e['id'],'role_id':r['id'],'required_count':1,'notes':'','assignments':[{'id':str(uuid.uuid4()),'person_id':self.person,'timing_mode':'day'}] if person else []} for e in events]}
 def save(self,data,identity=None,version=0,actor=base.A,fail=False,request=None):return self.rpc('iasdpi_schedule_plan_save',[identity or str(uuid.uuid4()),version,data,request or str(uuid.uuid4())],actor,fail)
 def test_current_month_preparation_skips_past_and_reuses_ids(self):
  a=self.prepare();b=self.prepare();self.assertTrue(a['events']);self.assertTrue(all(e['scheduled_on']>=str(self.today) for e in a['events']));self.assertEqual([e['id'] for e in a['events']],[e['id'] for e in b['events']])
 def test_today_and_current_month_can_save_and_publish(self):
  e=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Hoje sintético','date':str(self.today)},str(uuid.uuid4())]);data=self.plan([e]);p=self.save(data);p=self.save({'status':'published'},p['id'],p['version']);self.assertEqual(p['status'],'published')
 def test_past_and_unreleased_future_are_blocked_even_for_admin(self):
  for day in [self.today-datetime.timedelta(days=1),self.today+datetime.timedelta(days=365)]:
   self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Proibido sintético','date':str(day)},str(uuid.uuid4())],fail=True)
  self.prepare(self.first-datetime.timedelta(days=1),fail=True);self.prepare(self.first.replace(year=self.first.year+1),fail=True)
 def test_admin_window_change_keeps_current_and_existing_plans(self):
  settings=self.rpc('iasdpi_schedule_settings_get',[]);future=settings['future_months'][0];self.prepare(future)
  self.rpc('iasdpi_schedule_settings_save',[settings['version'],{'planning_months':1}]);one=self.rpc('iasdpi_schedule_settings_get',[]);self.assertEqual(len(one['future_months']),1);self.prepare();self.prepare(one['future_months'][0]);self.prepare(settings['future_months'][-1],fail=True)
  changed=self.rpc('iasdpi_schedule_settings_save',[one['version'],{'planning_months':3}]);self.prepare(changed['future_months'][-1]);self.assertGreater(int(self.sql('select count(*) from public.schedule_events')),0)
 def test_department_permission_admin_settings_and_anonymous(self):
  self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True});self.prepare(actor=base.U);self.prepare(dept=M,actor=base.U,fail=True)
  settings=self.rpc('iasdpi_schedule_settings_get',[]);self.rpc('iasdpi_schedule_settings_save',[settings['version'],{'planning_months':6}],base.U,True)
  self.sql("select public.iasdpi_schedule_prepare_month('%s','%s','%s','Culto fictício')"%(D,self.first,uuid.uuid4()),anonymous=True,fail=True)
 def test_other_church_and_direct_writes_remain_blocked(self):
  original=self.church;self.church='NAO_AUTORIZADA';self.prepare(fail=True);self.church=original
  self.sql("update public.schedule_settings set planning_months=6",actor=base.A,fail=True)
 def test_concurrent_preparation_does_not_duplicate_events(self):
  args=[D,str(self.first),str(uuid.uuid4()),'Concorrência sintética'];call='select public.iasdpi_schedule_prepare_month('+','.join(self.quote(str(x)) for x in args)+')';jobs=[]
  for _ in range(2):
   p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(call,base.A));p.stdin.close();p.stdin=None;jobs.append(p)
  output=[p.communicate(timeout=30) for p in jobs];self.assertTrue(all(p.returncode==0 for p in jobs),output);self.assertEqual(output[0][0],output[1][0])
 def test_current_plan_concurrent_version_is_rejected(self):
  p=self.save(self.plan());p2=self.save({'title':'Versão recente'},p['id'],p['version']);self.save({'title':'Versão antiga'},p['id'],p['version'],fail=True);self.assertEqual(p2['version'],2)
 def test_past_rows_preserved_and_tampering_rejected(self):
  if self.today.day==1:self.skipTest('Não há dias passados no mês atual no primeiro dia.')
  self.sql((base.ROOT/'database/023_schedule_edit_window_down.sql').read_text())
  yesterday=self.today-datetime.timedelta(days=1);e=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Passado sintético','date':str(yesterday)},str(uuid.uuid4())]);data=self.plan([e]);p=self.save(data)
  before=self.sql("select to_jsonb(a)::text from public.schedule_assignments a where plan_id='%s'"%p['id'])
  self.sql((base.ROOT/'database/023_schedule_edit_window.sql').read_text());new=self.prepare()['events'][0];role=self.rpc('iasdpi_schedule_daily_role',[D]);data['requirements'].append({'id':str(uuid.uuid4()),'event_id':new['id'],'role_id':role['id'],'required_count':1,'notes':'','assignments':[{'id':str(uuid.uuid4()),'person_id':self.person,'timing_mode':'day'}]});updated=self.save(data,p['id'],p['version']);self.assertEqual(before,self.sql("select to_jsonb(a)::text from public.schedule_assignments a where requirement_id='%s'"%data['requirements'][0]['id']))
  bad=copy.deepcopy(data);bad['requirements'][0]['notes']='Adulteração';self.save(bad,p['id'],updated['version'],fail=True)
  bad=copy.deepcopy(data);bad['requirements']=bad['requirements'][1:];self.save(bad,p['id'],updated['version'],fail=True)
  data['status']='published';published=self.save(data,p['id'],updated['version']);self.assertEqual(published['status'],'published')
 def test_rollback_preserves_all_data_and_restores_previous_functions(self):
  self.save(self.plan());before=self.sql("select jsonb_agg(to_jsonb(p))::text from public.schedule_plans p");self.sql((base.ROOT/'database/023_schedule_edit_window_down.sql').read_text());self.assertEqual(before,self.sql("select jsonb_agg(to_jsonb(p))::text from public.schedule_plans p"));self.assertNotIn('schedule_edit_policy',self.rpc('iasdpi_schedule_settings_get',[]))
 def test_past_empty_vacancy_does_not_require_illegal_retroactive_fill(self):
  if self.today.day==1:self.skipTest('Primeiro dia sem passado no mês corrente.')
  self.sql((base.ROOT/'database/023_schedule_edit_window_down.sql').read_text());yesterday=self.today-datetime.timedelta(days=1);e=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Vaga passada sintética','date':str(yesterday)},str(uuid.uuid4())]);data=self.plan([e],person=False);p=self.save(data)
  self.sql((base.ROOT/'database/023_schedule_edit_window.sql').read_text());extra=self.plan([self.prepare()['events'][0]]);data['requirements']+=extra['requirements'];data['status']='published';result=self.save(data,p['id'],p['version']);self.assertEqual(result['status'],'published');self.assertEqual(next(r for r in result['requirements'] if r['event_id']==e['id'])['assignments'],[])
 def test_real_competing_writes_only_one_version_wins(self):
  p=self.save(self.plan());jobs=[]
  for title in ['Edição concorrente A','Edição concorrente B']:
   data=[p['id'],p['version'],{'title':title},str(uuid.uuid4())];query='select public.iasdpi_schedule_plan_save('+','.join(self.quote(json.dumps(v) if isinstance(v,dict) else str(v)) for v in data)+')'
   job=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);job.stdin.write(self.command(query,base.A));job.stdin.close();job.stdin=None;jobs.append(job)
  output=[p.communicate(timeout=30) for p in jobs];self.assertEqual(sum(p.returncode==0 for p in jobs),1,output)
 def test_elders_closed_periods_blocked_and_active_month_allowed(self):
  d=self.sql("select id from public.schedule_departments where code='ancionato'");person=g9.G9LifecycleSQLTests.person(self,'Ancião sintético temporal',(d,));end=self.sql("select ('%s'::date+interval '1 month - 1 day')::date"%self.first)
  def row(first,last):return {'id':self.sql("select iasdpi_schedule_private.elder_id('%s','monthly','%s')"%(d,first)),'kind':'monthly','starts_on':str(first),'ends_on':str(last),'person_id':person,'expected_version':0}
  active=row(self.first,end);result=self.rpc('iasdpi_schedule_elder_save',[d,'draft',[active],str(uuid.uuid4())]);self.assertEqual(result['periods'][0]['person_id'],person)
  previous_end=self.first-datetime.timedelta(days=1);expired=row(previous_end.replace(day=1),previous_end);self.rpc('iasdpi_schedule_elder_save',[d,'draft',[expired],str(uuid.uuid4())],fail=True)
 def test_private_helpers_and_authorized_rpc_postinstall_checks(self):
  self.assertEqual(self.sql((base.ROOT/'database/check_schedule_edit_window.sql').read_text()),'')
