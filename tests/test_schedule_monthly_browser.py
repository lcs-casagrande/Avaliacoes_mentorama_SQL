"""B1.2: interface real, algoritmo e RPCs fictícias isoladas; nenhum Supabase real."""
from functools import partial
from http.server import ThreadingHTTPServer
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class MonthlyScheduleBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,monthly_preview=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.tmp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url));self.page.goto(self.url);self.page.wait_for_selector('.monthly-calendar')
    def tearDown(self):self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests));self.context.close()
    def generate(self):
        self.page.get_by_text('Preparar eventos e informações da escala',exact=True).click();self.page.locator('#b1-recurring button').click();self.page.wait_for_function("document.querySelectorAll('.monthly-day.has-events').length>0")
    def add(self,count=1):
        self.page.locator('.monthly-day.has-events').first.click();self.page.locator('#b1-add [name=count]').fill(str(count));self.page.locator('#b1-add button').click();self.page.wait_for_selector('.b1-requirement')
    def prepare_all(self):
        self.generate()
        for button in self.page.locator('.monthly-day.has-events').all():
            button.click();self.page.locator('#b1-add button').click()
    def prefill(self):self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')")
    def test_empty_month_explains_how_to_enable_rotation(self):
        button=self.page.locator('[data-b1-action=prefill]');self.assertTrue(button.is_disabled());self.assertEqual(button.get_attribute('aria-describedby'),'rotation-requirements-help');self.assertIn('adicione as funções e vagas',self.page.locator('#rotation-requirements-help').inner_text())
    def test_batch_reserves_proposals_across_departments_before_suggesting(self):
        result=self.source("const first=s.context.people[0].person_id;s.catalog.people.filter(p=>p.id!==first).forEach(p=>p.active=false);s.plan.requirements=s.plan.requirements.slice(0,1);const dept=s.catalog.departments.find(d=>d.code==='musica').id,role=s.catalog.roles.find(r=>r.department_id===dept).id,second={...s,department:dept,plan:{...structuredClone(s.plan),id:'other',requirements:[{...structuredClone(s.plan.requirements[0]),id:'other-r',role_id:role}]}};return IASDPIScheduleRotation.proposeBatch([s,second]).map(p=>p.added);")
        self.assertEqual(result,[1,0])
    def test_other_draft_warns_without_becoming_confirmed_conflict(self):
        result=self.source("s.context.people[0].days.forEach(d=>d.draft_dispute=true);const p=IASDPIScheduleRotation.propose(s);return {first:p.plan.requirements[0].assignments[0].person_id,expected:s.context.people[1].person_id,reasons:IASDPIScheduleRotation.reasons(s,s.plan.requirements[0],s.context.people[0].person_id),warnings:IASDPIScheduleRotation.warnings(s,s.plan.requirements[0],s.context.people[0].person_id)};")
        self.assertEqual(result['first'],result['expected']);self.assertEqual(result['reasons'],[]);self.assertTrue(result['warnings'])
    def test_same_function_never_repeats_person_to_fill_excess_slots(self):
        result=self.source("s.plan.requirements=s.plan.requirements.slice(0,1);s.plan.requirements[0].required_count=3;return IASDPIScheduleRotation.propose(s).plan.requirements[0].assignments.map(a=>a.person_id);")
        self.assertEqual(len(result),2);self.assertEqual(len(set(result)),2)
    def source(self,body='return s;'):
        return self.page.evaluate('''async body=>{
         const catalog=await IASDPISchedulePreview.request('iasdpi_schedule_catalog'),settings=await IASDPISchedulePreview.request('iasdpi_schedule_settings_get'),month=settings.future_months[0],department=catalog.departments[0].id,events=[1,4,7,11,14,18].map((day,i)=>({id:'e'+i,scheduled_on:month.slice(0,7)+'-'+String(day).padStart(2,'0'),timing_mode:'day'})),people=catalog.people.filter(p=>catalog.memberships.some(m=>m.department_id===department&&m.person_id===p.id));
         const context={basis_version:0,people:people.map(p=>({person_id:p.id,history_count:0,last_day:null,global_days:[],department_days:[],days:events.map(e=>({date:e.scheduled_on,state:'available',conflict:false}))}))},plan={id:crypto.randomUUID(),version:0,status:'draft',requirements:events.map((e,i)=>({id:'r'+i,event_id:e.id,role_id:catalog.roles[0].id,required_count:1,assignments:[]}))},s={catalog,context,plan,department,events};return Function('s',body)(s);
        }''',body)
    def test_rotation_balances_and_never_mutates_source_or_publishes(self):
        result=self.source("const before=JSON.stringify(s.plan),p=IASDPIScheduleRotation.propose(s),counts={};for(const r of p.plan.requirements)for(const a of r.assignments)counts[a.person_id]=(counts[a.person_id]||0)+1;return {counts,before:before===JSON.stringify(s.plan),status:p.plan.status,added:p.added};")
        self.assertEqual(sorted(result['counts'].values()),[3,3]);self.assertTrue(result['before']);self.assertEqual(result['status'],'draft');self.assertEqual(result['added'],6)
    def test_rotation_preserves_existing_assignments_and_legacy_precision(self):
        result=self.source("const a={id:'original',person_id:s.context.people[0].person_id,timing_mode:'timed',starts_at:s.events[0].scheduled_on+'T09:30:00.123456-03:00',ends_at:s.events[0].scheduled_on+'T10:30:00.654321-03:00'};s.plan.requirements[0].assignments=[a];const p=IASDPIScheduleRotation.propose(s);return {before:a,after:p.plan.requirements[0].assignments[0],added:p.added};")
        self.assertEqual(result['before'],result['after']);self.assertEqual(result['added'],5)
    def test_unknown_unavailable_inactive_unqualified_and_conflict_remain_vacancies(self):
        for mutation in ["s.context.people.forEach(p=>p.days.forEach(d=>d.state='unknown'));","s.context.people.forEach(p=>p.days.forEach(d=>d.state='unavailable'));","s.context.people.forEach(p=>p.days.forEach(d=>d.conflict=true));","s.catalog.people.forEach(p=>p.active=false);","s.catalog.qualifications=[];"]:
            self.assertEqual(self.source(mutation+"return IASDPIScheduleRotation.propose(s).added;"),0)
    def test_zero_limit_monthly_caps_and_history_continuity(self):
        result=self.source("const people=s.catalog.people.filter(p=>s.context.people.some(c=>c.person_id===p.id));people[0].max_monthly_count=0;people[1].max_monthly_count=2;return IASDPIScheduleRotation.propose(s).added;");self.assertEqual(result,2)
        result=self.source("s.context.people[0].history_count=4;s.context.people[0].last_day='2026-10-01';const p=IASDPIScheduleRotation.propose(s);return {chosen:p.plan.requirements[0].assignments[0].person_id,expected:s.context.people[1].person_id};");self.assertEqual(result['chosen'],result['expected'])
    def test_stale_context_rejected_without_replacing_plan(self):
        self.assertTrue(self.source("s.context.basis_version=8;try{IASDPIScheduleRotation.propose(s);return false;}catch(e){return e.message.includes('Atualize');}"))
    def test_circular_cursor_continues_after_last_published_person(self):
        result=self.source("s.context.people[0].history_count=2;s.context.people[1].history_count=2;s.context.people[0].last_day='2026-09-01';s.context.people[1].last_day='2026-10-01';return IASDPIScheduleRotation.propose(s).plan.requirements.map(r=>r.assignments[0].person_id);")
        self.assertEqual(result[::2],[result[0]]*3);self.assertNotEqual(result[0],result[1])
        self.assertTrue(result[0].endswith('020'))
    def test_membership_limit_and_external_load_respect_distinct_days(self):
        self.assertEqual(self.source("s.catalog.memberships.filter(m=>m.department_id===s.department).forEach(m=>m.max_monthly_count=1);return IASDPIScheduleRotation.propose(s).added;"),2)
        self.assertEqual(self.source("s.catalog.people.forEach(p=>p.max_monthly_count=1);s.context.people.forEach(p=>p.global_days=[s.events[0].scheduled_on]);s.events=s.events.slice(0,1);s.plan.requirements=s.plan.requirements.slice(0,1);return IASDPIScheduleRotation.propose(s).added;"),1)
    def test_historical_microseconds_at_midnight_preserve_occupied_day(self):
        result=self.source("const p=s.context.people[0],person=s.catalog.people.find(x=>x.id===p.person_id);person.max_monthly_count=2;s.events[0].scheduled_on=s.events[0].scheduled_on.slice(0,7)+'-01';const day=s.events[0].scheduled_on;s.plan.requirements[0].assignments=[{id:'legacy',person_id:p.person_id,timing_mode:'timed',starts_at:day+'T23:00:00-03:00',ends_at:day.slice(0,8)+'02T00:00:00.000001-03:00'}];return IASDPIScheduleRotation.reasons(s,s.plan.requirements[1],p.person_id);")
        self.assertIn('Limite mensal da pessoa atingido',result)
    def test_failed_save_preserves_editable_proposal_and_retry(self):
        self.generate();self.add();self.prefill();self.page.evaluate('IASDPIB1Preview.failNext=true');self.page.locator('[data-b1-action=save]').click();self.page.wait_for_selector('[role=alert]')
        self.assertIn('Seus campos continuam',self.page.locator('[role=alert]').inner_text());self.assertNotEqual(self.page.locator('.b1-requirement select').input_value(),'')
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
    def test_extraordinary_event_and_department_registered_without_new_component(self):
        self.page.get_by_text('Preparar eventos e informações da escala',exact=True).click();month=self.page.locator('#b1-scope [name=month]').input_value();self.page.locator('#b1-extra [name=extraTitle]').fill('Evento fictício extraordinário');self.page.locator('#b1-extra [name=extraDate]').fill('02/'+month[5:]+'/'+month[:4]);self.page.locator('#b1-extra button').click();self.page.wait_for_selector('.monthly-day.has-events')
        self.page.locator('.monthly-day.has-events').click();self.assertIn('Evento fictício extraordinário',self.page.locator('#monthly-day-details').inner_text())
        self.page.evaluate("IASDPISchedulePreview.request('iasdpi_schedule_save',{p_entity:'department',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{name:'Ministério fictício adicional',code:'ficticio'},p_request_id:crypto.randomUUID()})")
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_function("document.querySelectorAll('.monthly-departments button').length===5");self.page.locator('.monthly-departments button').last.click();self.page.wait_for_function("document.querySelector('h1').textContent==='Ministério fictício adicional'")
    def test_monthly_manual_replace_remove_and_draft_reopen(self):
        self.generate();self.add();self.prefill();self.page.locator('.monthly-day.has-events').first.click();select=self.page.locator('.b1-requirement select');original=select.input_value();other='00000000-0000-4000-8000-000000000021' if original.endswith('020') else '00000000-0000-4000-8000-000000000020';select.select_option(other)
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        plan=self.page.evaluate('[...IASDPIB1Preview.plans.values()].find(p=>p.month===document.querySelector("#b1-scope [name=month]").value+"-01")');self.assertEqual(plan['requirements'][0]['assignments'][0]['person_id'],other)
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('.monthly-calendar');self.page.locator('.monthly-day.has-events').first.click();self.assertEqual(self.page.locator('.b1-requirement select').input_value(),other)
        self.page.locator('.b1-requirement select').select_option('');self.assertIn('1 pendente',self.page.locator('.monthly-calendar').inner_text())
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_selector('[role=alert]');self.assertIn('vagas pendentes',self.page.locator('[role=alert]').inner_text())
    def test_proposal_all_days_counts_and_no_auto_save(self):
        self.prepare_all();self.prefill();feedback=self.page.locator('#b1-feedback').inner_text();self.assertIn('0 pendentes',feedback)
        self.assertEqual(self.page.evaluate('[...IASDPIB1Preview.plans.values()].filter(p=>p.month===document.querySelector("#b1-scope [name=month]").value+"-01").length'),0)
        self.assertEqual(self.page.locator('.monthly-metrics dd').nth(2).inner_text(),'0')
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.assertEqual(self.page.evaluate('[...IASDPIB1Preview.plans.values()].at(-1).status'),'draft')
    def test_departments_responsive_calendar_and_keyboard_day(self):
        self.assertEqual(self.page.locator('.monthly-departments button').count(),4)
        for button in self.page.locator('.monthly-departments button').all():button.click();self.page.wait_for_selector('.monthly-calendar')
        self.assertIn('Ancionato',self.page.locator('h1').inner_text())
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('.monthly-day').first.focus();self.page.keyboard.press('Enter');self.assertEqual(self.page.evaluate('document.activeElement.id'),'monthly-day-details')
    def test_available_people_reasons_and_conflict_from_other_department(self):
        self.generate();self.add();self.page.locator('.b1-requirement select').select_option('00000000-0000-4000-8000-000000000020');self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.page.locator('[data-b1-action=department]').nth(2).click();self.page.wait_for_selector('.monthly-calendar');self.page.locator('.monthly-day.has-events').first.click();self.page.locator('#b1-add button').click();self.page.locator('summary').filter(has_text='Sugestões e impedimentos').click()
        self.assertIn('Conflito com outro departamento',self.page.locator('#monthly-day-details').inner_text())
