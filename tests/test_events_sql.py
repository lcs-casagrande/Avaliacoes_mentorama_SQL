"""E1: PostgreSQL descartável, sem conexão com Supabase real."""
import copy,json,subprocess,unittest,uuid
import test_g9_lifecycle_sql as g9
import test_user_management_sql as base
import test_church_isolation_sql as g1
D=g9.D;M=g9.M

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class EventSQLTests(unittest.TestCase):
    sql=g9.G9LifecycleSQLTests.sql;command=g9.G9LifecycleSQLTests.command
    quote=staticmethod(g9.G9LifecycleSQLTests.quote);rpc=g9.G9LifecycleSQLTests.rpc;grant=g9.G9LifecycleSQLTests.grant
    snapshot=g9.G9LifecycleSQLTests.snapshot;service=g9.G9LifecycleSQLTests.service
    @classmethod
    def setUpClass(cls):g9.G9LifecycleSQLTests.setUpClass.__func__(cls)
    def setUp(self):
        g9.G9LifecycleSQLTests.setUp(self)
        self.sql((base.ROOT/'database/020_calendar_events.sql').read_text())
    def event(self,patch=None,actor=base.A):
        data={'title':'Evento E1 descartável','date':'2031-01-01','category':'church'};data.update(patch or {})
        return self.rpc('iasdpi_event_save',[str(uuid.uuid4()),0,data,str(uuid.uuid4())],actor)
    def save(self,e,patch,actor=base.A,fail=False,request=None):return self.rpc('iasdpi_event_save',[e['id'],e['version'],patch,request or str(uuid.uuid4())],actor,fail)
    def public(self,month='2031-01-01'):
        return json.loads(self.sql("select public.iasdpi_events_published('%s')"%month,anonymous=True))
    def test_draft_publish_revision_cancel_preserves_history_and_core(self):
        e=self.event();self.assertEqual(self.public()['events'],[])
        p=self.save(e,{'status':'published'});self.assertEqual(self.public()['events'][0]['title'],e['title'])
        d=self.save(p,{'title':'Revisão privada','status':'draft'});self.assertEqual(self.public()['events'][0]['title'],e['title'])
        p=self.save(d,{'status':'published'});self.assertEqual(self.public()['events'][0]['title'],'Revisão privada')
        c=self.save(p,{'status':'cancelled','cancellation_reason':'Motivo privado'});self.assertEqual(self.public()['events'],[])
        self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),5);self.assertEqual(c['created_by'],e['created_by'])
        self.assertEqual(self.snapshot()['core_fingerprints'],self.before['core_fingerprints'])
    def test_leader_only_own_department_and_viewer_cannot_write(self):
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True})
        e=self.event({'category':'department','department_id':D},base.U)
        e=self.save(e,{'status':'published'},base.U)
        self.save(e,{'department_id':M},base.U,True)
        self.rpc('iasdpi_event_save',[str(uuid.uuid4()),0,{'title':'Proibido','date':'2031-01-01','category':'church'},str(uuid.uuid4())],base.U,True)
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':False,'publish':False},version=1)
        self.save(e,{'title':'Proibido'},base.U,True)
        self.assertEqual(len(self.rpc('iasdpi_events_catalog',[],base.U)['events']),1)
        self.rpc('iasdpi_events_catalog',[],base.X,True)
    def test_nullable_times_precise_partial_save_and_invalid_values(self):
        e=self.event({'start_time':'09:30:05.123456','end_time':'11:01:02.654321','location':'Local real informado','description':'Preservar'})
        p=self.save(e,{'title':'Outro título'});self.assertEqual(p['start_time'],'09:30:05.123456');self.assertEqual(p['description'],'Preservar')
        for patch in [{'created_by':base.B},{'start_time':'25:00'},{'end_date':'2030-01-01'},{'category':None,'status':'published'},{'category':'department','department_id':None,'status':'published'}]:self.save(p,patch,fail=True)
        no=self.event({'title':'Sem horário'});self.assertIsNone(no['start_time']);self.assertIsNone(no['end_time'])
    def test_public_projection_is_sanitized_and_anonymous_cannot_mutate(self):
        e=self.event();self.save(e,{'status':'published'})
        public=json.dumps(self.public());self.assertNotIn('created_by',public);self.assertNotIn('updated_by',public);self.assertNotIn('cancellation_reason',public)
        for q in ['select * from public.iasdpi_events','delete from public.iasdpi_events','update public.iasdpi_event_versions set status=\'cancelled\'','select public.iasdpi_events_catalog()']:
            self.sql(q,anonymous=True,fail=True)
        self.sql('delete from public.iasdpi_events',actor=base.A,fail=True)
    def test_source_association_is_admin_only_unique_and_cancel_suppresses_source(self):
        e=self.event({'source_key':'official-source-stable','source_url':'https://iasd-paradainglesa.netlify.app/'})
        self.rpc('iasdpi_event_save',[str(uuid.uuid4()),0,{'title':'Outro título','date':'2031-01-01','category':'church','source_key':e['source_key'],'source_url':e['source_url']},str(uuid.uuid4())],base.A,True)
        p=self.save(e,{'status':'published'});self.assertEqual(self.public()['suppressed_source_keys'],[e['source_key']])
        self.save(p,{'status':'cancelled'});self.assertEqual(self.public()['suppressed_source_keys'],[e['source_key']]);self.assertEqual(self.public()['events'],[])
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True})
        self.rpc('iasdpi_event_save',[str(uuid.uuid4()),0,{'title':'Fonte indevida','date':'2031-01-01','category':'department','department_id':D,'source_key':'other','source_url':e['source_url']},str(uuid.uuid4())],base.U,True)
    def test_idempotent_retry_and_revocation_are_revalidated(self):
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True});e=self.event({'category':'department','department_id':D},base.U)
        request=str(uuid.uuid4());a=self.save(e,{'title':'Confirmado'},base.U,request=request);b=self.save(e,{'title':'Confirmado'},base.U,request=request);self.assertEqual(a,b)
        self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),2)
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':False,'publish':False},version=1);self.save(e,{'title':'Confirmado'},base.U,True,request)
    def test_concurrent_updates_only_one_wins_and_keeps_other_fields(self):
        e=self.event({'description':'Manter'});processes=[]
        for title in ['Primeira edição','Segunda edição']:
            query="select public.iasdpi_event_save('%s',1,'%s','%s')"%(e['id'],json.dumps({'title':title}),uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;processes.append(p)
        outputs=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs)
        records=self.rpc('iasdpi_events_catalog',[])['events'];self.assertEqual(len(records),1);self.assertEqual(records[0]['description'],'Manter');self.assertEqual(records[0]['version'],2)
    def test_concurrent_imports_do_not_duplicate_source(self):
        processes=[]
        for n in range(2):
            patch={'title':'Evento importado','date':'2031-01-01','category':'church','source_key':'same-source','source_url':'https://iasd-paradainglesa.netlify.app/'}
            query="select public.iasdpi_event_save('%s',0,'%s','%s')"%(uuid.uuid4(),json.dumps(patch),uuid.uuid4())
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(self.command(query,base.A));p.stdin.close();p.stdin=None;processes.append(p)
        outputs=[p.communicate(timeout=30) for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1,outputs);self.assertEqual(self.sql('select count(*) from public.iasdpi_events'),'1')
    def test_church_boundary_rejects_cross_church_edit_and_read(self):
        e=self.event();g1.ChurchIsolationSQLTests.other(self);self.church='TEST_ONLY'
        self.assertEqual(self.rpc('iasdpi_events_catalog',[],base.B)['events'],[])
        self.rpc('iasdpi_event_history',[e['id']],base.B,True);self.save(e,{'title':'Acesso cruzado'},base.B,True)
        self.assertEqual(self.public()['events'],[])
    def test_migration_security_properties_and_no_automatic_import(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_calendar_events.sql').read_text()),'')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_events'),'0')
        self.assertEqual(self.sql("select count(*) from pg_class where relname in('iasdpi_events','iasdpi_event_versions') and relrowsecurity and relforcerowsecurity"),'2')
        self.assertEqual(self.sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('iasdpi_events_catalog','iasdpi_event_save','iasdpi_event_history','iasdpi_events_published') and pg_get_userbyid(p.proowner)='iasdpi_church_executor' and p.prosecdef and p.proconfig @> ARRAY['search_path=\"\"']"),'4')
        self.assertEqual(self.sql("select has_function_privilege('anon','public.iasdpi_event_save(uuid,bigint,jsonb,uuid)','execute')"),'f')
        self.assertEqual(self.sql("select has_function_privilege('authenticated','iasdpi_schedule_private.event_can(uuid,text,uuid,text)','execute')"),'f')
    def test_empty_rollback_preserves_previous_features_and_populated_rollback_is_refused(self):
        self.sql((base.ROOT/'database/020_calendar_events_down.sql').read_text())
        self.assertEqual(self.snapshot()['core_fingerprints'],self.before['core_fingerprints'])
        self.sql((base.ROOT/'database/020_calendar_events.sql').read_text());self.event()
        self.sql((base.ROOT/'database/020_calendar_events_down.sql').read_text(),fail=True)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_events'),'1')
    def test_multiple_events_same_day_do_not_create_schedule_assignments(self):
        count=self.sql('select count(*) from public.schedule_events')
        self.event({'title':'Primeiro compromisso'});self.event({'title':'Segundo compromisso'})
        self.assertEqual(len(self.rpc('iasdpi_events_catalog',[])['events']),2)
        self.assertEqual(self.sql('select count(*) from public.schedule_events'),count)
    def test_unknown_start_can_be_draft_but_cannot_be_published_with_end_only(self):
        e=self.event({'end_time':'11:30'});self.assertIsNone(e['start_time']);self.assertEqual(e['end_time'],'11:30:00')
        self.save(e,{'status':'published'},fail=True)
    def test_explicit_all_day_preserved_without_inventing_midnight(self):
        e=self.event({'all_day':True});e=self.save(e,{'status':'published'})
        self.assertTrue(self.public()['events'][0]['all_day']);self.assertIsNone(e['start_time']);self.assertIsNone(e['end_time'])
        self.save(e,{'start_time':'09:30'},fail=True)
        e=self.save(e,{'description':'Mesmo dia inteiro'})
        self.assertTrue(e['all_day']);self.assertIsNone(e['start_time'])
