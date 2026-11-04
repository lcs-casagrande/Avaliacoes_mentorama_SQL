"""022: PostgreSQL descartável, transações concorrentes e RLS reais, sem Supabase."""
import json,subprocess,unittest,uuid
import test_calendar_privacy_sql as privacy
import test_events_sql as events
import test_user_management_sql as base
import test_g9_lifecycle_sql as g9
D=g9.D;M=g9.M
@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável --network none')
class EventPlanningSQLTests(unittest.TestCase):
    setUpClass=classmethod(events.EventSQLTests.setUpClass.__func__)
    sql=events.EventSQLTests.sql;command=events.EventSQLTests.command;quote=staticmethod(events.EventSQLTests.quote);rpc=events.EventSQLTests.rpc;grant=events.EventSQLTests.grant;service=events.EventSQLTests.service
    public=events.EventSQLTests.public;snapshot=events.EventSQLTests.snapshot
    def setUp(self):
        privacy.CalendarPrivacySQLTests.setUp(self)
        self.sql((base.ROOT/'database/022_event_planning.sql').read_text())
    def data(self,**patch):
        year=self.sql("select extract(year from now() at time zone 'America/Sao_Paulo')::int")
        result=dict(title='Evento sintético 022',date=year+'-11-07',end_date=year+'-11-07',category='department',department_id=D,program_category='departmental',organizer_kind='department',organizer_department_id=D,all_day=False,start_time='14:00',end_time='16:00',spaces=['nave'],status='published');result.update(patch);return result
    def event(self,**patch):return self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(**patch),str(uuid.uuid4()),False])['event']
    def test_single_and_public_reservation(self):
        e=self.event();self.assertEqual(e['status'],'published');self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
        self.assertEqual(self.public(e['date'][:7]+'-01')['events'][0]['id'],e['id'])
    def test_general_pending_not_public(self):
        e=self.event(program_category='general');self.assertEqual(e['approval_status'],'pending');self.assertEqual(e['status'],'draft');self.assertEqual(self.public(e['date'][:7]+'-01')['events'],[])
    def series(self,data=None,accept=False,identity=None,version=0,scope='all',occurrence=None):
        return self.rpc('iasdpi_event_series_save',[identity or str(uuid.uuid4()),version,data or self.data(title='Série sintética',recurrence='weekly',recurrence_weekday=6),str(uuid.uuid4()),scope,occurrence,accept])
    def test_multi_space_exclusive_overlap_adjacent_and_shared(self):
        e=self.event(spaces=['nave','patio'])
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'2')
        for code in ['nave','patio']:
            self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(title='Conflitante',spaces=[code],start_time='15:00',end_time='17:00'),str(uuid.uuid4()),False],fail=True)
        self.event(title='Depois',start_time='16:00',end_time='17:00',spaces=['nave'])
        for title in ['Salas A','Salas B']:self.event(title=title,spaces=['salas','externo'])
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'3')
    def test_all_day_blocks_any_timed_reservation_same_day(self):
        self.event(all_day=True,start_time=None,end_time=None,spaces=['quadra'])
        self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(title='Horário bloqueado',spaces=['quadra']),str(uuid.uuid4()),False],fail=True)
    def test_series_weekly_public_and_monthly_first_thursday_limit(self):
        r=self.series();self.assertFalse(r['requires_confirmation']);self.assertGreater(len(r['events']),1)
        self.assertTrue(all(e['status']=='published' for e in r['events']))
        self.assertTrue(all(e['date']<=r['series']['until_date'] for e in r['events']))
        monthly=self.series(self.data(title='Primeira quinta',spaces=['salas'],recurrence='monthly',recurrence_weekday=4,recurrence_ordinal=1))
        import datetime
        for e in monthly['events']:
            day=datetime.date.fromisoformat(e['date']);self.assertEqual(day.weekday(),3);self.assertLessEqual(day.day,7)
    def test_series_conflicts_require_confirmation_and_never_confirm_reservations(self):
        original=self.event(title='Reserva anterior')
        data=self.data(title='Série com conflitos',recurrence='weekly',recurrence_weekday=6)
        identifier=str(uuid.uuid4());r=self.series(data,identity=identifier)
        self.assertTrue(r['requires_confirmation']);self.assertGreater(r['conflict_count'],0)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_series'),'0')
        r=self.series(data,accept=True,identity=identifier)
        self.assertEqual(r['series']['approval_status'],'pending');self.assertTrue(all(e['status']=='draft' for e in r['events']))
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
        self.assertEqual([e['id'] for e in self.public(original['date'][:7]+'-01')['events']],[original['id']])
        resolved=self.series({'spaces':['salas'],'status':'published'},accept=True,identity=identifier,version=r['series']['version'])
        self.assertEqual(resolved['series']['approval_status'],'pending')
    def test_edit_following_all_and_cancel_one_preserve_ids_history(self):
        r=self.series(self.data(title='Título original',spaces=['salas'],recurrence='weekly',recurrence_weekday=6))
        events=r['events'];identifier=r['series']['id'];cutoff=events[1]
        r2=self.series({'title':'Título futuro','status':'published'},identity=identifier,version=1,scope='following',occurrence=cutoff['id'])
        self.assertEqual(self.sql("select title from public.iasdpi_events where id='%s'"%events[0]['id']),'Título original')
        self.assertEqual({e['id'] for e in r2['events']},{e['id'] for e in events[1:]})
        r3=self.series({'title':'Todos editados','status':'published'},identity=identifier,version=2)
        self.assertEqual({e['id'] for e in r3['events']},{e['id'] for e in events})
        e=r3['events'][0];self.rpc('iasdpi_event_submit',[e['id'],e['version'],{'status':'cancelled'},str(uuid.uuid4()),False])
        self.assertEqual(self.sql('select count(*) from public.iasdpi_events where series_id=\'%s\' and status=\'cancelled\''%identifier),'1')
        self.assertGreater(len(self.rpc('iasdpi_event_history',[e['id']])),1)
        self.rpc('iasdpi_event_series_save',[identifier,1,{'title':'Edição antiga'},str(uuid.uuid4()),'all',None,False],fail=True)
    def test_invalid_series_date_after_dynamic_year_end_is_rejected(self):
        year=int(self.sql("select extract(year from now() at time zone 'America/Sao_Paulo')::int"))+1
        self.rpc('iasdpi_event_series_save',[str(uuid.uuid4()),0,self.data(date=f'{year}-01-01',end_date=f'{year}-01-01',recurrence='weekly'),str(uuid.uuid4()),'all',None,False],fail=True)
    def test_roles_church_and_approval_cannot_be_forged(self):
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True})
        e=self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(program_category='general'),str(uuid.uuid4()),False],base.U)['event']
        self.assertEqual(e['approval_status'],'pending')
        for patch in [{'approval_status':'approved'},{'department_id':M},{'category':'church','department_id':None}]:
            self.rpc('iasdpi_event_submit',[e['id'],e['version'],patch,str(uuid.uuid4()),False],base.U,True)
        self.sql('select * from public.iasdpi_event_reservations',anonymous=True,fail=True)
        self.sql('insert into public.iasdpi_event_series(id) values(gen_random_uuid())',actor=base.A,fail=True)
        self.sql("select public.iasdpi_event_preview('{}')",anonymous=True,fail=True)
    def test_concurrent_saves_cannot_double_reserve_same_space(self):
        processes=[]
        for title in ['Concorrente A','Concorrente B']:
            query="select public.iasdpi_event_submit('%s',0,%s,'%s',false)"%(uuid.uuid4(),self.quote(json.dumps(self.data(title=title))),uuid.uuid4())
            process=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env)
            process.stdin.write(self.command(query,base.A));process.stdin.close();process.stdin=None;processes.append(process)
        outputs=[p.communicate(timeout=30) for p in processes]
        self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
    def test_legacy_precision_and_private_conflict_title_are_preserved(self):
        e=self.event(title='PRIVADO DESCARTÁVEL',is_restricted=True,start_time='14:00:01.123456',end_time='16:00:02.654321')
        self.grant(user=base.U,dept=M,flags={'view':True,'edit':True,'publish':True})
        data=self.data(title='Outra equipe',department_id=M,organizer_department_id=M)
        r=json.loads(self.sql('select public.iasdpi_event_preview('+self.quote(json.dumps(data))+",'{}'::uuid[])",actor=base.U))
        self.assertNotIn('PRIVADO DESCARTÁVEL',json.dumps(r,ensure_ascii=False));self.assertIn('Evento restrito',json.dumps(r,ensure_ascii=False))
        updated=self.rpc('iasdpi_event_submit',[e['id'],e['version'],{'description':'Texto editado','status':'draft'},str(uuid.uuid4()),False])['event']
        self.assertEqual(updated['start_time'],e['start_time']);self.assertEqual(updated['end_time'],e['end_time'])
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
    def test_rollback_refuses_populated_data_and_empty_restores_021(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_event_planning.sql').read_text()),'')
        self.sql("delete from public.iasdpi_event_spaces where code='externo'")
        self.sql((base.ROOT/'database/022_event_planning_down.sql').read_text(),fail=True)
        self.sql("insert into public.iasdpi_event_spaces select id,'externo','Externo',false from public.iasdpi_churches where code='IASD_PI'")
        self.sql((base.ROOT/'database/022_event_planning_down.sql').read_text())
        self.assertEqual(self.sql("select to_regclass('public.iasdpi_event_series') is null"),'t')
        self.sql((base.ROOT/'database/022_event_planning.sql').read_text());e=self.event()
        self.sql((base.ROOT/'database/022_event_planning_down.sql').read_text(),fail=True)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_events'),'1')
    def test_historical_rows_not_reclassified_and_fingerprints_preserved(self):
        self.sql((base.ROOT/'database/022_event_planning_down.sql').read_text())
        historical=self.rpc('iasdpi_event_save',[str(uuid.uuid4()),0,{'title':'Histórico intacto','date':'2025-01-01','category':'church','status':'published','location':'Endereço ainda não conciliado','start_time':'09:30:05.123456','end_time':'10:00:06.654321'},str(uuid.uuid4())])
        before=self.sql("select snapshot::text from public.iasdpi_event_versions where event_id='%s'"%historical['id'])
        self.sql((base.ROOT/'database/022_event_planning.sql').read_text())
        self.assertEqual(self.sql("select snapshot::text from public.iasdpi_event_versions where event_id='%s'"%historical['id']),before)
        current=self.rpc('iasdpi_events_catalog',[])['events'][0]
        self.assertEqual(current['id'],historical['id']);self.assertIsNone(current['spaces']);self.assertEqual(current['approval_status'],'legacy')
        self.assertEqual(current['location'],historical['location']);self.assertEqual(self.public('2025-01-01')['events'][0]['id'],historical['id'])
    def test_series_pending_revision_is_hidden_and_cannot_be_self_approved(self):
        r=self.series(self.data(spaces=['salas'],recurrence='weekly',recurrence_weekday=6));identifier=r['series']['id']
        changed=self.series({'program_category':'general','status':'published'},identity=identifier,version=1)
        self.assertEqual(changed['series']['approval_status'],'pending')
        self.assertEqual(self.public(r['events'][0]['date'][:7]+'-01')['events'],[])
        self.rpc('iasdpi_event_series_save',[identifier,2,{'approval_status':'approved'},str(uuid.uuid4()),'all',None,False],fail=True)
    def test_conflict_does_not_leak_unpublished_revision_title(self):
        e=self.event(title='Título público anterior')
        self.rpc('iasdpi_event_submit',[e['id'],1,{'title':'TÍTULO DE RASCUNHO SECRETO','status':'draft'},str(uuid.uuid4()),False])
        self.grant(user=base.U,dept=M,flags={'view':True,'edit':True,'publish':True})
        data=self.data(department_id=M,organizer_department_id=M)
        result=json.loads(self.sql('select public.iasdpi_event_preview('+self.quote(json.dumps(data))+",'{}'::uuid[])",actor=base.U))
        self.assertNotIn('TÍTULO DE RASCUNHO SECRETO',json.dumps(result,ensure_ascii=False));self.assertIn('Título público anterior',json.dumps(result,ensure_ascii=False))
    def test_microsecond_boundary_blocks_overlap_and_allows_exact_adjacency(self):
        e=self.event(start_time='14:00:00.000001',end_time='16:00:00.000001')
        self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(title='Um microssegundo de conflito',start_time='16:00',end_time='17:00'),str(uuid.uuid4()),False],fail=True)
        self.event(title='Depois exato',start_time='16:00:00.000001',end_time='17:00')
    def test_same_department_same_day_self_overlapping_series_stays_pending(self):
        data=self.data(title='Série de intervalos sobrepostos',end_date=self.data()['date'][:8]+'20',recurrence='weekly',recurrence_weekday=6)
        result=self.series(data);self.assertTrue(result['requires_confirmation'])
        result=self.series(data,accept=True);self.assertEqual(result['series']['approval_status'],'pending');self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'0')
    def test_other_church_cannot_access_series_events_or_reservations(self):
        import test_church_isolation_sql as churches
        r=self.series(self.data(spaces=['salas'],recurrence='weekly',recurrence_weekday=6));churches.ChurchIsolationSQLTests.other(self);self.church='TEST_ONLY'
        self.assertEqual(self.rpc('iasdpi_events_catalog',[],base.B)['events'],[])
        self.rpc('iasdpi_event_history',[r['events'][0]['id']],base.B,True)
        self.rpc('iasdpi_event_series_save',[r['series']['id'],1,{'title':'Acesso cruzado','status':'draft'},str(uuid.uuid4()),'all',None,False],base.B,True)
    def test_concurrent_series_publish_only_one_confirms_exclusive_space(self):
        tasks=[]
        for title in ['Série concorrente A','Série concorrente B']:
            data=self.data(title=title,recurrence='weekly',recurrence_weekday=6)
            query="select public.iasdpi_event_series_save('%s',0,%s,'%s','all',null,false)"%(uuid.uuid4(),self.quote(json.dumps(data)),uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;tasks.append(p)
        outputs=[p.communicate(timeout=30) for p in tasks]
        self.assertEqual(sum(p.returncode==0 for p in tasks),2,outputs)
        results=[json.loads(out[0]) for out in outputs];self.assertEqual(sum(r.get('requires_confirmation',False) for r in results),1)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_event_series'),'1')
    def test_simultaneous_shared_space_bookings_both_succeed(self):
        processes=[]
        for title in ['Compartilhado A','Compartilhado B']:
            query="select public.iasdpi_event_submit('%s',0,%s,'%s',false)"%(uuid.uuid4(),self.quote(json.dumps(self.data(title=title,spaces=['salas','externo']))),uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;processes.append(p)
        outputs=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),2,outputs);self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'0')
    def test_same_title_times_different_exclusive_spaces_are_allowed(self):
        a=self.event(title='Mesmo título em locais diferentes',spaces=['nave'])
        b=self.event(title='Mesmo título em locais diferentes',spaces=['quadra'])
        self.assertNotEqual(a['id'],b['id']);self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'2')
