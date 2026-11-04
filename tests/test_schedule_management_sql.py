"""B1: migrações e RLS em PostgreSQL descartável com rede desabilitada."""
import json
import subprocess
import unittest
import uuid
import test_schedule_foundation_sql as foundation
import test_user_management_sql as base

D,E=foundation.D,foundation.E

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class ScheduleManagementSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    call=foundation.ScheduleFoundationSQLTests.call
    catalog=foundation.ScheduleFoundationSQLTests.catalog
    person=foundation.ScheduleFoundationSQLTests.person
    grant=foundation.ScheduleFoundationSQLTests.grant
    def setUp(self):
        foundation.ScheduleFoundationSQLTests.setUp(self)
        self.sql((base.ROOT/'database/006_schedule_management.sql').read_text())
        self.p=self.person()
        self.role=self.call('role',dict(department_id=D,name='Áudio'))['id']
        self.other_role=self.call('role',dict(department_id=E,name='Apoio'))['id']
        membership=self.catalog()['memberships'][0]
        self.call('membership',dict(role_ids=[self.role]),id=membership['id'],version=1)
        self.call('membership',dict(person_id=self.p['id'],department_id=E,role_ids=[self.other_role]))
    def rpc(self,name,args,actor=base.A,fail=False):
        values=[]
        for value in args:
            values.append('null' if value is None else "'%s'"%(json.dumps(value).replace("'","''") if isinstance(value,dict) else str(value).replace("'","''")))
        result=self.sql('select public.'+name+'('+','.join(values)+')',actor=actor,fail=fail)
        return None if fail else json.loads(result)
    def event(self,date='2026-10-10',start='09:30',end='11:30',dept=D,title='Culto fictício',**kwargs):
        return self.rpc('iasdpi_schedule_event_create',[kwargs.pop('id',str(uuid.uuid4())),dict(department_id=dept,title=title,date=date,start_time=start,end_time=end,**kwargs.pop('extra',{})),kwargs.pop('request',str(uuid.uuid4()))],**kwargs)
    def requirements(self,event,dept=D,person=True,start=None,end=None):
        item=dict(id=str(uuid.uuid4()),event_id=event['id'],role_id=self.role if dept==D else self.other_role,required_count=1,notes='Observação fictícia',assignments=[])
        if person:
            a=dict(id=str(uuid.uuid4()),person_id=self.p['id'])
            if start:a['starts_at']=start
            if end:a['ends_at']=end
            item['assignments'].append(a)
        return [item]
    def save(self,event=None,dept=D,data=None,id=None,version=0,**kwargs):
        return self.rpc('iasdpi_schedule_plan_save',[id or str(uuid.uuid4()),version,data if data is not None else dict(department_id=dept,month='2026-10-01',title='Escala de teste',requirements=self.requirements(event,dept)),kwargs.pop('request',str(uuid.uuid4()))],**kwargs)
    def workspace(self,dept=D,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_workspace',[dept,'2026-10-01'],actor,fail)
    def test_events_idempotent_across_departments_no_duplicate(self):
        one=self.event();two=self.event(dept=E)
        self.assertEqual(one['id'],two['id']);self.assertEqual(self.sql('select count(*) from public.schedule_events'),'1')
        self.event(end='12:00',fail=True)
        self.assertEqual(self.workspace()['events'][0]['ends_at'],one['ends_at'])
    def test_external_reference_duplicate_and_mismatch(self):
        one=self.event(extra={'source':'official','source_key':'fictitious-only'})
        self.assertEqual(one['id'],self.event(extra={'source':'official','source_key':'fictitious-only'})['id'])
        self.event(date='2026-10-11',extra={'source':'official','source_key':'fictitious-only'},fail=True)
    def test_configurable_hours_timezone_and_overnight(self):
        e=self.event(start='21:15',end='01:30',extra={'end_date':'2026-10-11'})
        self.assertEqual(self.sql("select to_char(starts_at at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') from public.schedule_events"),'2026-10-10 21:15')
        self.assertIn('2026-10-11',e['ends_at']);self.event(start='21:15',end='01:30',fail=True)
    def test_historical_timezone_uses_named_zone(self):
        self.event(date='2018-12-01',start='09:30')
        self.assertEqual(self.sql("select to_char(starts_at at time zone 'UTC','HH24:MI') from public.schedule_events"),'11:30')
    def test_save_reopen_same_ids_versions_and_partial_patch(self):
        plan=self.save(self.event());old_ids=[a['id'] for a in plan['requirements'][0]['assignments']]
        updated=self.save(id=plan['id'],version=1,data={'title':'Nome revisado'})
        self.assertEqual(updated['version'],2);self.assertEqual(updated['requirements'],plan['requirements'])
        self.assertEqual(self.workspace()['plan']['id'],plan['id'])
        self.assertEqual([a['id'] for a in updated['requirements'][0]['assignments']],old_ids)
        first=self.rpc('iasdpi_schedule_plan_version',[plan['id'],1]);self.assertEqual(first,plan)
    def test_duplicate_plan_and_stale_version_rejected(self):
        e=self.event();plan=self.save(e);self.save(e,fail=True)
        self.save(id=plan['id'],data={'title':'Versão antiga'},fail=True)
        self.assertEqual(self.workspace()['plan']['version'],1)
    def test_retry_receipts_identity_signature_and_revocation(self):
        request=str(uuid.uuid4());identifier=str(uuid.uuid4());e=self.event();data=dict(department_id=D,month='2026-10-01',requirements=self.requirements(e))
        first=self.save(id=identifier,data=data,request=request)
        self.assertEqual(first,self.save(id=identifier,data=data,request=request))
        self.save(id=identifier,data={'department_id':D},request=request,fail=True)
        self.grant();self.save(id=identifier,data=data,request=request,actor=base.L,fail=True)
    def test_draft_vacancies_and_publish_coverage(self):
        e=self.event();plan=self.save(data=dict(department_id=D,month='2026-10-01',requirements=self.requirements(e,person=False)))
        self.assertEqual(plan['status'],'draft')
        self.save(id=plan['id'],version=1,data={'status':'published'},fail=True)
        plan=self.save(id=plan['id'],version=1,data={'requirements':self.requirements(e),'status':'published'})
        self.assertEqual(plan['status'],'published');self.assertEqual(plan['version'],2)
        self.assertEqual(len(self.workspace()['versions']),2)
    def test_empty_published_plan_denied(self):
        self.save(data=dict(department_id=D,month='2026-10-01',requirements=[],status='published'),fail=True)
        self.assertIsNone(self.workspace()['plan'])
    def test_cross_department_overlap_blocked_and_rollback_preserves_plan(self):
        e=self.event();self.save(e);self.save(e,dept=E,fail=True)
        self.assertIsNone(self.workspace(E)['plan']);self.assertEqual(len(self.workspace()['plan']['requirements']),1)
    def test_same_day_distinct_non_overlapping_times_allowed(self):
        self.save(self.event());self.save(self.event(start='11:30',end='12:00'),dept=E)
        self.assertEqual(self.sql('select count(*) from public.schedule_assignments'),'2')
    def test_partial_participation_uses_actual_intervals(self):
        e=self.event();self.save(data=dict(department_id=D,month='2026-10-01',requirements=self.requirements(e,start='2026-10-10T09:30:00-03:00',end='2026-10-10T10:30:00-03:00')))
        self.save(dept=E,data=dict(department_id=E,month='2026-10-01',requirements=self.requirements(e,E,start='2026-10-10T10:30:00-03:00',end='2026-10-10T11:30:00-03:00')))
        self.assertEqual(self.sql('select count(*) from public.schedule_assignments'),'2')
    def test_interval_outside_event_denied(self):
        e=self.event();self.save(data=dict(department_id=D,month='2026-10-01',requirements=self.requirements(e,start='2026-10-10T08:30:00-03:00')),fail=True)
    def test_unqualified_inactive_and_wrong_department_role_denied(self):
        e=self.event();m=next(m for m in self.catalog()['memberships'] if m['department_id']==D)
        self.call('membership',dict(role_ids=[]),id=m['id'],version=m['version']);self.save(e,fail=True)
        self.call('membership',dict(role_ids=[self.role],active=False),id=m['id'],version=m['version']+1);self.save(e,fail=True)
        req=self.requirements(e);req[0]['role_id']=self.other_role
        self.save(data=dict(department_id=D,month='2026-10-01',requirements=req),fail=True)
    def test_weekly_and_period_unavailability(self):
        e=self.event();v=self.call('availability',dict(person_id=self.p['id'],department_id=None,kind='unavailable',pattern='weekly',weekdays=[6],start_time='10:00',end_time='12:00'))
        self.save(e,fail=True);self.call('availability',dict(active=False),id=v['id'],version=1)
        self.call('availability',dict(person_id=self.p['id'],department_id=E,kind='unavailable',pattern='period',starts_on='2026-10-09',ends_on='2026-10-11'))
        self.save(e);self.save(e,dept=E,fail=True)
    def test_later_availability_or_qualification_change_cannot_invalidate_saved_assignments(self):
        self.save(self.event())
        self.call('availability',dict(person_id=self.p['id'],department_id=None,kind='unavailable',pattern='period',starts_on='2026-10-10',ends_on='2026-10-10'),fail=True)
        m=next(m for m in self.catalog()['memberships'] if m['department_id']==D)
        self.call('membership',dict(role_ids=[]),id=m['id'],version=m['version'],fail=True)
        self.call('membership',dict(role_ids=[self.role]),id=m['id'],version=m['version'])
        self.assertEqual(len(self.workspace()['plan']['requirements'][0]['assignments']),1)
    def test_duplicate_role_person_excess_vacancies_and_month_mismatch(self):
        e=self.event();req=self.requirements(e)
        for requirements in [req+req,[{**req[0],'required_count':0}],[{**req[0],'assignments':req[0]['assignments']*2}]]:
            self.save(data=dict(department_id=D,month='2026-10-01',requirements=requirements),fail=True)
        self.save(self.event(date='2026-11-01'),fail=True)
    def test_permissions_admin_manager_viewer_unauthorized_and_anon(self):
        self.grant();self.grant(actor=base.U,level='viewer')
        e=self.event(actor=base.L);plan=self.save(e,actor=base.L)
        self.assertEqual(self.workspace(actor=base.U)['plan']['id'],plan['id'])
        self.save(id=plan['id'],version=1,data={'title':'Proibido'},actor=base.U,fail=True)
        self.workspace(E,actor=base.L,fail=True);self.event(dept=E,actor=base.L,fail=True)
        for actor in [base.V,base.N,base.X]:self.workspace(actor=actor,fail=True)
        self.sql("select public.iasdpi_schedule_workspace('%s','2026-10-01')"%D,anonymous=True,fail=True)
        self.rpc('iasdpi_schedule_plan_version',[plan['id'],1],actor=base.V,fail=True)
    def test_global_leader_has_no_implicit_department_management(self):
        self.event(actor=base.L,fail=True);self.workspace(actor=base.L,fail=True)
    def test_revocation_blocks_save_and_receipt_replay(self):
        self.grant();e=self.event(actor=base.L);req=str(uuid.uuid4());identifier=str(uuid.uuid4());data=dict(department_id=D,month='2026-10-01',requirements=self.requirements(e))
        self.save(id=identifier,data=data,request=req,actor=base.L)
        self.sql("select public.iasdpi_set_access('%s','leader',false)"%base.L,actor=base.A)
        self.save(id=identifier,data=data,request=req,actor=base.L,fail=True)
    def test_direct_rest_private_functions_rls_and_owner(self):
        for name in ['events','plans','requirements','assignments','versions']:
            self.sql('select * from public.schedule_'+name,actor=base.A,fail=True)
            self.sql('delete from public.schedule_'+name,actor=base.A,fail=True)
        self.sql("select iasdpi_schedule_private.plan_snapshot(gen_random_uuid())",actor=base.A,fail=True)
        self.assertEqual(self.sql((base.ROOT/'database/check_schedule_management.sql').read_text()),'')
    def test_legacy_unchanged(self):
        self.save(self.event());self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
    def test_down_empty_only_and_existing_data_protected(self):
        down=(base.ROOT/'database/006_schedule_management_down.sql').read_text()
        self.sql(down);self.assertEqual(self.sql("select to_regclass('public.schedule_events') is null"),'t')
        self.sql((base.ROOT/'database/006_schedule_management.sql').read_text())
        self.event();self.sql(down,fail=True)
        self.assertEqual(self.sql('select count(*) from public.schedule_events'),'1')
    def test_forged_department_and_injected_privilege_fields_rejected(self):
        e=self.event();plan=self.save(e);self.grant(dept=E)
        self.save(id=plan['id'],version=1,data={'department_id':E},actor=base.L,fail=True)
        self.save(id=plan['id'],version=1,data={'version':99},fail=True)
        self.event(extra={'source':'incomplete-origin'},fail=True)
        self.assertEqual(self.workspace()['plan']['version'],1)
    def test_removal_preserves_previous_version_and_failed_batch_is_atomic(self):
        e=self.event();plan=self.save(e)
        self.save(id=plan['id'],version=1,data={'requirements':[]})
        self.assertEqual(len(self.rpc('iasdpi_schedule_plan_version',[plan['id'],1])['requirements']),1)
        req=self.requirements(e);req.append({**req[0],'id':str(uuid.uuid4()),'role_id':str(uuid.uuid4())})
        self.save(id=plan['id'],version=2,data={'requirements':req},fail=True)
        self.assertEqual(self.workspace()['plan']['requirements'],[])
    def test_concurrent_same_plan_cas_only_one_edit_commits(self):
        plan=self.save(self.event());processes=[]
        for label in ['Primeira edição','Segunda edição']:
            data=json.dumps({'title':label});query="select public.iasdpi_schedule_plan_save('%s',1,'%s'::jsonb,'%s');select pg_sleep(0.4)"%(plan['id'],data,uuid.uuid4())
            proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env)
            proc.stdin.write(self.command(query,base.A));proc.stdin.close();processes.append(proc)
        codes=[]
        for proc in processes:proc.wait(timeout=20);codes.append(proc.returncode);proc.stdout.close();proc.stderr.close()
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(self.workspace()['plan']['version'],2)
    def test_concurrent_cross_department_conflict_one_commit_only(self):
        e=self.event();queries=[]
        for dept in [D,E]:
            data=dict(department_id=dept,month='2026-10-01',requirements=self.requirements(e,dept))
            q="select public.iasdpi_schedule_plan_save('%s',0,'%s'::jsonb,'%s');select pg_sleep(0.5)"%(uuid.uuid4(),json.dumps(data),uuid.uuid4())
            queries.append(self.command(q,base.A))
        processes=[subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env) for _ in queries]
        for proc,q in zip(processes,queries):proc.stdin.write(q);proc.stdin.close()
        codes=[]
        for proc in processes:proc.wait(timeout=20);codes.append(proc.returncode);proc.stdout.close();proc.stderr.close()
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(self.sql('select count(*) from public.schedule_assignments'),'1')
