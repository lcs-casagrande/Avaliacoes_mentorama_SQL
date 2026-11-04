"""B1.1 em PostgreSQL isolado: sem conexão com Supabase de produção."""
import json
import subprocess
import unittest
import uuid
import test_schedule_management_sql as b1
import test_user_management_sql as base
D,E=b1.D,b1.E

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class DailyScheduleSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    call=b1.ScheduleManagementSQLTests.call
    catalog=b1.ScheduleManagementSQLTests.catalog
    person=b1.ScheduleManagementSQLTests.person
    grant=b1.ScheduleManagementSQLTests.grant
    rpc=b1.ScheduleManagementSQLTests.rpc
    event=b1.ScheduleManagementSQLTests.event
    requirements=b1.ScheduleManagementSQLTests.requirements
    save=b1.ScheduleManagementSQLTests.save
    def setUp(self):
        b1.ScheduleManagementSQLTests.setUp(self)
        event=self.event();self.old=self.save(data={'department_id':D,'month':'2026-10-01','requirements':self.requirements(event,start='2026-10-10T09:30:00.123456-03:00')})
        self.save(self.event(start='12:00',end='13:00'),dept=E)
        self.before=self.sql("select jsonb_agg(jsonb_build_object('id',id,'starts',starts_at,'ends',ends_at,'person',person_id) order by id) from public.schedule_assignments")
        self.sql((base.ROOT/'database/007_daily_schedules.sql').read_text())
    def profile(self,weekdays=None,**kwargs):
        p=next(p for p in self.catalog()['people'] if p['id']==self.p['id'])
        data={'weekdays':weekdays if weekdays is not None else {str(d):'available' for d in range(7)},**kwargs}
        return self.rpc('iasdpi_schedule_member_save',[p['id'],p['version'],data,str(uuid.uuid4())])
    def daily_event(self,day='2031-01-01',dept=D,actor=base.A):
        return self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':dept,'title':'Culto diário fictício','date':day},str(uuid.uuid4())],actor)
    def plan(self,event,dept=D,actor=base.A,fail=False,person=True):
        return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':dept,'month':event['scheduled_on'][:7]+'-01','title':'Escala por dia','requirements':self.requirements(event,dept,person)},str(uuid.uuid4())],actor,fail)
    def test_default_settings_and_future_months(self):
        settings=self.rpc('iasdpi_schedule_settings_get',[])
        self.assertEqual(settings['planning_months'],2);self.assertEqual(set(settings['weekdays']),{0,3,6})
        self.assertEqual(self.sql("select array_to_json(iasdpi_schedule_private.future_months('2026-10-31',2))"),'["2026-11-01","2026-12-01"]')
        self.assertEqual(self.sql("select array_to_json(iasdpi_schedule_private.future_months('2026-12-01',3))"),'["2027-01-01","2027-02-01","2027-03-01"]')
    def test_legacy_values_and_two_departments_preserved(self):
        after=self.sql("select jsonb_agg(jsonb_build_object('id',id,'starts',starts_at,'ends',ends_at,'person',person_id) order by id) from public.schedule_assignments")
        self.assertEqual(after,self.before)
        self.assertEqual(self.sql("select count(*) from public.schedule_assignments where timing_mode='timed' and assigned_on='2026-10-10'"),'2')
        self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'date':'2026-10-10','title':'Culto fictício'},str(uuid.uuid4())],fail=True)
    def test_daily_without_hours_and_unknown_is_not_confirmation(self):
        e=self.daily_event();self.assertIsNone(e['starts_at']);self.assertEqual(e['timing_mode'],'day')
        self.plan(e,fail=True);self.profile();plan=self.plan(e)
        a=plan['requirements'][0]['assignments'][0];self.assertIsNone(a['starts_at']);self.assertIsNone(a['ends_at']);self.assertEqual(a['assigned_on'],'2031-01-01')
        person=next(p for p in self.catalog()['people'] if p['id']==self.p['id'])
        self.rpc('iasdpi_schedule_member_save',[person['id'],person['version'],{'weekdays':{}},str(uuid.uuid4())],fail=True)
        self.assertEqual(self.sql("select iasdpi_schedule_private.day_availability('%s','%s','2031-01-01')"%(person['id'],D)),'available')
    def test_two_departments_same_day_blocked(self):
        self.profile();e=self.daily_event();self.plan(e);self.plan(e,E,fail=True)
    def test_admin_exception_justification_and_audit(self):
        self.profile();e=self.daily_event();self.plan(e)
        data={'person_id':self.p['id'],'day':e['scheduled_on'],'department_a':D,'department_b':E,'reason':'Autorização fictícia para teste.'}
        self.grant(dept=E)
        self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,data],base.L,True)
        self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,{**data,'reason':'curto'}],fail=True)
        approval=self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,data]);self.plan(e,E)
        self.assertEqual(approval['approved_by'],base.A)
        self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='daily-exception'"),'1')
        self.rpc('iasdpi_schedule_exception_save',[approval['id'],1,{'enabled':False}],fail=True)
    def test_settings_admin_cas_and_existing_plans_not_removed(self):
        settings=self.rpc('iasdpi_schedule_settings_get',[]);self.grant()
        self.rpc('iasdpi_schedule_settings_save',[1,{'planning_months':6,'weekdays':[1,4]}],base.L,True)
        changed=self.rpc('iasdpi_schedule_settings_save',[1,{'planning_months':6,'weekdays':[1,4]}]);self.assertEqual(changed['planning_months'],6)
        self.rpc('iasdpi_schedule_settings_save',[1,{'planning_months':1}],fail=True)
        for count in [0,4,12]:self.rpc('iasdpi_schedule_settings_save',[2,{'planning_months':count}],fail=True)
        self.assertEqual(self.sql('select count(*) from public.schedule_plans'),'2')
    def test_generation_enabled_days_extra_dates_and_idempotency(self):
        settings=self.rpc('iasdpi_schedule_settings_get',[]);first=settings['future_months'][0]
        settings=self.rpc('iasdpi_schedule_settings_save',[settings['version'],{'planning_months':1,'weekdays':[],'extra_dates':[first]}])
        request=str(uuid.uuid4());rows=self.rpc('iasdpi_schedule_generate_days',[D,'Datas de teste',request])
        self.assertEqual(len(rows['events']),1);self.assertEqual(rows['events'][0]['scheduled_on'],first)
        self.assertEqual(rows,self.rpc('iasdpi_schedule_generate_days',[D,'Datas de teste',request]))
        self.assertGreater(first[:7],settings['today'][:7]);self.assertEqual(rows['events'][0]['timing_mode'],'day')
    def test_negative_dates_weekly_flags_and_monthly_limit(self):
        self.profile(unavailable_dates=['2031-01-01'],max_monthly_count=1);self.plan(self.daily_event(),fail=True)
        self.plan(self.daily_event('2031-01-02'));self.plan(self.daily_event('2031-01-03'),E,fail=True)
    def test_member_sheet_is_projection_and_no_accounts_required(self):
        self.profile();sheet=self.rpc('iasdpi_schedule_members',[])
        self.assertEqual(len(sheet['members']),1);self.assertEqual(len(sheet['catalog']['memberships']),2)
        self.assertNotIn('auth_user_id',sheet['members'][0]);self.assertEqual(sheet['members'][0]['weekdays']['3'],'available')
        history=self.rpc('iasdpi_schedule_person_history',[self.p['id']]);self.assertEqual(len(history['current']),2);self.assertEqual(len(history['versions']),2)
        self.rpc('iasdpi_schedule_members',[],base.L,True)
    def test_concurrent_same_day_cross_department_only_one_commit(self):
        self.profile();e=self.daily_event();processes=[]
        for dept in [D,E]:
            data={'department_id':dept,'month':'2031-01-01','requirements':self.requirements(e,dept)}
            q="select public.iasdpi_schedule_plan_save('%s',0,'%s','%s');select pg_sleep(0.5)"%(uuid.uuid4(),json.dumps(data),uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(q,base.A));p.stdin.close();processes.append(p)
        codes=[]
        for p in processes:p.wait(timeout=20);codes.append(p.returncode);p.stdout.close();p.stderr.close()
        self.assertEqual(sorted(codes),[0,3])
    def test_unknown_partial_hours_do_not_confirm_whole_day(self):
        self.call('availability',{'person_id':self.p['id'],'department_id':D,'kind':'available','pattern':'weekly','weekdays':[0,1,2,3,4,5,6],'start_time':'09:00','end_time':'12:00'})
        self.plan(self.daily_event(),fail=True)
    def test_new_timed_records_also_obey_same_day_rule(self):
        self.profile();self.plan(self.event(date='2031-01-01'))
        self.plan(self.event(date='2031-01-01',start='13:00',end='14:00'),E,fail=True)
    def test_exception_is_scoped_to_person_date_and_departments(self):
        self.profile();event=self.daily_event();self.plan(event)
        data={'person_id':self.p['id'],'day':'2031-01-02','department_a':D,'department_b':E,'reason':'Autorização válida só no dia seguinte.'}
        self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,data]);self.plan(event,E,fail=True)
        self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,{**data,'approved_by':base.L}],fail=True)
    def test_settings_all_sizes_weekdays_and_sao_paulo_boundary(self):
        version=1
        for size in [1,2,3,6]:
            config=self.rpc('iasdpi_schedule_settings_save',[version,{'planning_months':size,'weekdays':[1,4]}]);version=config['version'];self.assertEqual(len(config['future_months']),size)
        data=self.rpc('iasdpi_schedule_generate_days',[D,'Cultos configurados',str(uuid.uuid4())])
        self.assertTrue(data['events']);self.assertEqual(self.sql("select count(*) from public.schedule_events where timing_mode='day' and extract(dow from scheduled_on) not in (1,4)"),'0')
        self.assertEqual(self.sql("select array_to_json(iasdpi_schedule_private.future_months(('2026-11-01T01:00:00Z'::timestamptz at time zone 'America/Sao_Paulo')::date,2))"),'["2026-11-01","2026-12-01"]')
        self.assertEqual(self.sql('select count(*) from public.schedule_assignments'),'2')
    def test_direct_writes_and_private_functions_denied(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_daily_schedules.sql').read_text()),'')
        for actor in [base.A,base.L,base.U]:
            self.sql('select * from public.schedule_settings',actor=actor,fail=True)
            self.sql('delete from public.schedule_day_exceptions',actor=actor,fail=True)
            self.sql("select iasdpi_schedule_private.has_day_exception(gen_random_uuid(),current_date,gen_random_uuid(),gen_random_uuid())",actor=actor,fail=True)
        self.sql('select public.iasdpi_schedule_settings_get()',anonymous=True,fail=True)
        self.rpc('iasdpi_schedule_member_save',[self.p['id'],1,{'weekdays':{}},str(uuid.uuid4())],base.L,True)
    def test_pending_unknown_and_profile_changes_do_not_erase_manual_rules(self):
        rule=self.call('availability',{'person_id':self.p['id'],'department_id':E,'kind':'unavailable','pattern':'period','starts_on':'2031-01-03','ends_on':'2031-01-03'})
        self.profile();self.profile({'3':'unknown','6':'available'})
        self.assertEqual(self.sql("select count(*) from public.schedule_availability where id='%s' and origin='manual'"%rule['id']),'1')
        self.assertEqual(self.sql("select iasdpi_schedule_private.day_availability('%s','%s','2031-01-01')"%(self.p['id'],D)),'unknown')
