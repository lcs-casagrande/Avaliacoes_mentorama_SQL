"""Referências informadas: fonte única, histórico imutável, confirmações explícitas."""
from functools import partial
from http.server import ThreadingHTTPServer
import json
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class KnownPeoplePreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,known_people=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url))
        # Esta família de cenários usa novembro/2026 como próximo mês, não o relógio da máquina.
        self.page.clock.set_fixed_time('2026-10-15T15:00:00Z');self.page.goto(self.url);self.page.wait_for_selector('.monthly-calendar')
    def tearDown(self):self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests));self.context.close()
    def catalog(self):return self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_catalog')")
    def members(self):self.page.locator('[data-demo-view=schedule-members]').click();self.page.wait_for_selector('.daily-member-table')
    def confirm(self,name='Luan',role='Operador de áudio confirmado'):
        c=self.catalog();person=next(p for p in c['people'] if p['name']==name);department=next(d for d in c['departments'] if d['code']=='sonoplastia');self.members();self.page.get_by_text('Confirmar habilitação de uma pessoa',exact=True).click();form=self.page.locator('#daily-qualification-confirm');form.locator('[name=person_id]').select_option(person['id']);form.locator('[name=department_id]').select_option(department['id']);form.locator('[name=role_name]').fill(role);form.locator('[name=confirmed]').check();form.locator('button').click();self.page.wait_for_function("document.querySelector('[role=status]').textContent!=='' || document.querySelector('.daily-member-table')")
        self.page.wait_for_function("async()=> (await IASDPISchedulePreview.request('iasdpi_schedule_catalog')).qualifications.length>0")
        return person,department
    def test_known_names_unique_and_similar_names_never_merged(self):
        c=self.catalog();people={p['name']:p for p in c['people']}
        for name in ['Mini Lucas','Rafa','Samuel','Luan','Macedo','Paulitos','Raphael','Henrique','Izabelle PI Souza','Simone/Profª de Pilates','macedo Logos','Letícia PI']:self.assertIn(name,people)
        self.assertEqual(len(c['people']),len(people));self.assertEqual(len(people),42);self.assertNotEqual(people['Rafa']['id'],people['Raphael']['id']);self.assertNotEqual(people['Macedo']['id'],people['macedo Logos']['id']);self.assertNotEqual(people['Simone Cristina']['id'],people['Simone/Profª de Pilates']['id'])
        self.assertFalse(any('Pessoa Alfa' in p['name'] for p in c['people']))
    def test_no_availability_limit_or_qualification_is_invented(self):
        c=self.catalog();self.assertEqual(c['availability'],[]);self.assertEqual(c['qualifications'],[]);self.assertEqual(c['roles'],[]);self.assertTrue(all(p['max_monthly_count'] is None for p in c['people']));self.members();self.assertEqual(self.page.locator('[data-member] [name^=available_]:checked').count(),0);self.assertIn('Pendente de confirmação',self.page.locator('main').inner_text())
    def test_leadership_does_not_grant_qualification_and_shared_person_is_one_id(self):
        c=self.catalog();person=next(p for p in c['people'] if p['name']=='Samuel');links=[m for m in c['memberships'] if m['person_id']==person['id']];self.assertGreaterEqual(len(links),2)
        luan=next(p for p in c['people'] if p['name']=='Luan');sono=next(d for d in c['departments'] if d['code']=='sonoplastia');member=next(m for m in c['memberships'] if m['person_id']==luan['id'] and m['department_id']==sono['id']);self.assertTrue(member['is_ministry_head']);self.assertFalse(any(q['membership_id']==member['id'] for q in c['qualifications']))
    def test_confirmation_updates_existing_person_not_duplicate_or_availability(self):
        before=self.catalog();person,department=self.confirm();after=self.catalog();self.assertEqual(len(after['people']),len(before['people']));self.assertEqual(after['availability'],[]);self.assertEqual(len(after['qualifications']),1);self.assertEqual(next(p['id'] for p in after['people'] if p['name']=='Luan'),person['id'])
        self.page.locator('[data-demo-view=schedule-build]').click();self.page.wait_for_selector('.monthly-calendar');self.page.get_by_text('Preparar eventos e informações da escala',exact=True).click();self.page.locator('#b1-recurring button').click();self.page.wait_for_selector('.monthly-day.has-events');self.page.locator('.monthly-day.has-events').first.click();self.page.locator('#b1-add button').click();self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')");self.assertEqual(self.page.locator('.monthly-metrics dd').nth(1).inner_text(),'0');self.assertIn('Pendente de confirmação',self.page.locator('#monthly-day-details').inner_text())
    def test_explicit_availability_allows_rotation_and_history_is_not_changed(self):
        before=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)');person,_=self.confirm();row=self.page.locator('[data-member="'+person['id']+'"]')
        for day in [0,3,6]:row.locator('[name=available_'+str(day)+']').check()
        row.locator('button[type=submit]').click();self.page.wait_for_function("async()=> (await IASDPISchedulePreview.request('iasdpi_schedule_catalog')).availability.length>0")
        self.page.locator('[data-demo-view=schedule-build]').click();self.page.wait_for_selector('.monthly-calendar');self.page.get_by_text('Preparar eventos e informações da escala',exact=True).click();self.page.locator('#b1-recurring button').click();self.page.wait_for_selector('.monthly-day.has-events');self.page.locator('.monthly-day.has-events').first.click();self.page.locator('#b1-add button').click();self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')");self.assertEqual(self.page.locator('.monthly-metrics dd').nth(1).inner_text(),'1');self.assertEqual(before,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
    def test_twenty_historical_rows_original_spelling_calendar_and_general_history(self):
        rows=self.page.evaluate('IASDPIKnownPreviewSeed.rows');self.assertEqual(sum(r['department']=='Sonoplastia' for r in rows),15);self.assertEqual(sum(r['department']=='Comunicação' for r in rows),5);self.assertEqual(len({r['id'] for r in rows}),20);self.assertIn('Simone/Profªde Pilates 🧘',[r['person'] for r in rows])
        self.members();c=self.catalog();p=next(p for p in c['people'] if p['name']=='Mini Lucas');self.page.locator('[data-member="'+p['id']+'"] [data-daily-action=history]').click();self.page.wait_for_selector('#daily-history');self.assertIn('03/10/2026',self.page.locator('#daily-history').inner_text());self.assertIn('Pendente de confirmação',self.page.locator('#daily-history').inner_text())
    def test_all_views_responsive_and_test_scenario_is_separate_link(self):
        self.assertIn('NOMES INFORMADOS',self.page.locator('.demo-label').inner_text());self.assertEqual(self.page.locator('a[href="IASDPI-B12-cenario-teste.html"]').count(),1)
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.members()
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
    def test_duplicate_name_is_rejected_without_creating_another_person(self):
        result=self.page.evaluate("async()=>{try{await IASDPISchedulePreview.request('iasdpi_schedule_save',{p_entity:'person',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{name:'Rafa',display_name:'Rafa'},p_request_id:crypto.randomUUID()});return false;}catch(e){return e.message.includes('Nome já cadastrado');}}")
        self.assertTrue(result);self.assertEqual(len(self.catalog()['people']),42)
    def test_draft_dispute_warns_then_publication_blocks_same_day(self):
        result=self.page.evaluate('''async()=>{
         const rpc=IASDPISchedulePreview.request,c=await rpc('iasdpi_schedule_catalog'),p=c.people.find(p=>p.name==='Rafa'),departments=[c.departments.find(d=>d.code==='sonoplastia'),c.departments.find(d=>d.code==='comunicacao')],month=(await rpc('iasdpi_schedule_settings_get')).future_months[0],roles=[];
         for(const d of departments){const role=await rpc('iasdpi_schedule_save',{p_entity:'role',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{name:'Função confirmada somente neste teste',department_id:d.id},p_request_id:crypto.randomUUID()});roles.push(role);const m=c.memberships.find(m=>m.person_id===p.id&&m.department_id===d.id);await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:m?.id||crypto.randomUUID(),p_expected_version:m?.version||0,p_data:{person_id:p.id,department_id:d.id,role_ids:[role.id]},p_request_id:crypto.randomUUID()});}
         await rpc('iasdpi_schedule_save',{p_entity:'availability',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:p.id,kind:'available',pattern:'weekly',weekdays:[0,1,2,3,4,5,6],active:true},p_request_id:crypto.randomUUID()});
         const event=await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:departments[0].id,date:month,title:'Evento isolado neste teste'}}),plans=[];
         for(let i=0;i<2;i++){const data={department_id:departments[i].id,month,status:'draft',title:'Rascunho isolado',requirements:[{id:crypto.randomUUID(),event_id:event.id,role_id:roles[i].id,required_count:1,notes:'',assignments:[{id:crypto.randomUUID(),person_id:p.id,timing_mode:'day'}]}]};plans.push(await rpc('iasdpi_schedule_plan_save',{p_id:crypto.randomUUID(),p_expected_version:0,p_data:data}));}
         const before=(await rpc('iasdpi_schedule_rotation_context',{p_department:departments[0].id,p_month:month})).people.find(x=>x.person_id===p.id).days[0];
         await rpc('iasdpi_schedule_plan_save',{p_id:plans[0].id,p_expected_version:1,p_data:{...plans[0],status:'published'}});
         let blocked=false;try{await rpc('iasdpi_schedule_plan_save',{p_id:plans[1].id,p_expected_version:1,p_data:{...plans[1],status:'published'}});}catch(e){blocked=e.message.includes('Conflito');}
         return {before,blocked,people:(await rpc('iasdpi_schedule_catalog')).people.filter(x=>x.name==='Rafa').length,history:IASDPIKnownPreview.legacy.length};
        }''')
        self.assertTrue(result['before']['draft_dispute']);self.assertFalse(result['before']['conflict']);self.assertTrue(result['blocked']);self.assertEqual(result['people'],1);self.assertEqual(result['history'],20)

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ConfirmationScenarioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,confirmation_test=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    setUp=KnownPeoplePreviewTests.setUp
    tearDown=KnownPeoplePreviewTests.tearDown
    def test_ready_rotation_uses_only_explicit_fictional_scenario(self):
        self.assertIn('CENÁRIO DE TESTE',self.page.locator('.demo-label').inner_text());c=self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_catalog')");self.assertTrue(all(p['name'].startswith('Voluntário ') for p in c['people']));self.assertEqual(self.page.evaluate('IASDPIKnownPreview.legacy.length'),0)
        self.assertTrue(self.page.locator('[data-b1-action=prefill]').is_enabled());self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')");self.assertEqual(self.page.locator('.monthly-metrics dd').nth(2).inner_text(),'0')
    def test_new_context_marks_other_draft_as_dispute_not_confirmed(self):
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')");self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.page.locator('[data-b1-action=department]').nth(2).click();self.page.wait_for_selector('.monthly-calendar');result=self.page.evaluate("async()=>{const c=await IASDPISchedulePreview.request('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.code==='musica'),month=document.querySelector('#b1-scope [name=month]').value+'-01';return IASDPISchedulePreview.request('iasdpi_schedule_rotation_context',{p_department:d.id,p_month:month});}")
        self.assertTrue(any(d['draft_dispute'] for p in result['people'] for d in p['days']));self.assertFalse(any(d['conflict'] for p in result['people'] for d in p['days']))
