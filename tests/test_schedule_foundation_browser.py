"""Chromium: UI real, Supabase HTTP simulado; nenhum dado de produção."""
import copy
import json
from pathlib import Path
import shutil
import unittest
import uuid
import test_frontend_access as base

D='a0000000-0000-4000-8000-000000000001'
E='a0000000-0000-4000-8000-000000000002'

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ScheduleFoundationBrowserTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    def setUp(self):
        base.FrontendAccessTests.setUp(self);self.role='admin';self.fail_catalog=False;self.fail_save=None;self.requests=[];self.details={};self.receipts={}
        self.catalog={'actor_id':base.USER,'is_admin':True,'departments':[{'id':D,'code':'sonoplastia','name':'Sonoplastia','active':True,'version':1,'can_manage':True,'can_roster':True},{'id':E,'code':'diaconato','name':'Diaconato','active':True,'version':1,'can_manage':True,'can_roster':True}], 'people':[],'roles':[],'memberships':[],'qualifications':[],'availability':[],'access':[]}
    tearDown=base.FrontendAccessTests.tearDown
    def supabase(self,route):
        path=route.request.url.split('/rest/v1/rpc/')[-1]
        if path.startswith('iasdpi_schedule_') or path=='iasdpi_find_account':
            self.requests.append((path,route.request.post_data))
            if route.request.headers.get('authorization')!='Bearer valid.test.token':route.fulfill(status=401,json={});return
            body=json.loads(route.request.post_data or '{}')
            if path=='iasdpi_schedule_catalog':
                if self.fail_catalog:route.fulfill(status=503,json={})
                else:route.fulfill(json=self.catalog)
            elif path=='iasdpi_schedule_person_details':route.fulfill(json=self.details.get(body['p_id'],{'contact':'','notes':'','auth_user_id':None}))
            elif path=='iasdpi_find_account':route.fulfill(json=[{'user_id':'44444444-4444-4444-8444-444444444444','confirmed':True,'email':body['p_email']}])
            elif path=='iasdpi_schedule_save':
                if self.fail_save:
                    route.fulfill(status=409,json={'code':self.fail_save,'message':'Cadastro mudou em outro dispositivo.' if self.fail_save=='40001' else 'Erro simulado de conexão.'});return
                if body['p_request_id'] in self.receipts:route.fulfill(json=self.receipts[body['p_request_id']]);return
                entity=body['p_entity'];table={'person':'people','department':'departments','membership':'memberships','role':'roles','availability':'availability','access':'access'}[entity]
                old=next((r for r in self.catalog[table] if r['id']==body['p_id']),None)
                if (old or {}).get('version',0)!=body['p_expected_version']:route.fulfill(status=409,json={'code':'40001','message':'Cadastro mudou em outro dispositivo.'});return
                data={'active':True,'enabled':True,**(old or {}),**body['p_data'],'id':body['p_id'],'version':body['p_expected_version']+1}
                if entity=='person':
                    self.details[data['id']]={k:data.pop(k,None) for k in ['contact','notes','auth_user_id']}
                    dept=data.pop('department_id',None)
                    if not old and dept:self.catalog['memberships'].append({'id':str(uuid.uuid4()),'department_id':dept,'person_id':data['id'],'version':1,'active':True})
                if entity=='membership' and 'role_ids' in data:
                    self.catalog['qualifications']=[q for q in self.catalog['qualifications'] if q['membership_id']!=data['id']]
                    self.catalog['qualifications'] += [{'membership_id':data['id'],'role_id':role,'department_id':data['department_id']} for role in data.pop('role_ids')]
                if old:old.update(data)
                else:self.catalog[table].append(data)
                self.receipts[body['p_request_id']]=copy.deepcopy(data);route.fulfill(json=data)
            return
        base.FrontendAccessTests.supabase(self,route)
    def open(self):
        self.page.goto(self.base+'#schedule-setup');self.page.wait_for_selector('#schedule-login')
        self.page.locator('#schedule-login [name="email"]').fill('test@example.invalid')
        self.page.locator('#schedule-login [name="password"]').fill('correct-password')
        self.page.locator('#schedule-login button').click();self.page.wait_for_selector('.schedule-tabs')
    def tab(self,name):self.page.locator('[data-schedule-action="tab"][data-id="'+name+'"]').click()
    def create_person(self,name='Participante fictício'):
        self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('#schedule-editor [name="name"]').fill(name)
        self.page.locator('#schedule-editor [name="display_name"]').fill(name)
        self.save()
    def save(self):
        self.page.locator('#schedule-editor button[type="submit"]').click();self.page.wait_for_selector('#schedule-editor',state='detached')
    def test_anonymous_shows_login_and_no_catalog_data(self):
        self.page.goto(self.base+'#schedule-setup');self.page.wait_for_selector('#schedule-login')
        self.assertEqual(self.page.locator('.schedule-list').count(),0);self.assertEqual(self.requests,[])
    def test_login_create_edit_reload_same_id_and_no_local_source(self):
        self.open();self.create_person();id=self.catalog['people'][0]['id']
        self.page.locator('[data-schedule-action="edit"]').click();self.page.locator('[name="display_name"]').fill('Nome atualizado');self.save()
        self.page.reload();self.page.wait_for_selector('.schedule-list');self.assertIn('Nome atualizado',self.page.locator('.schedule-list').inner_text())
        self.assertEqual(len(self.catalog['people']),1);self.assertEqual(self.catalog['people'][0]['id'],id)
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('iasdpi-demo-v1')).length"),1)
    def test_department_role_membership_and_qualification(self):
        self.open();self.create_person();self.tab('roles')
        self.page.locator('[data-schedule-action="create"]').click();self.page.locator('[name="name"]').fill('Operador de áudio');self.save()
        self.tab('memberships');self.page.locator('[data-schedule-action="edit"]').click()
        self.page.get_by_label('Operador de áudio',exact=True).check();self.page.get_by_label('Participações mensais desejadas (opcional)').fill('0');self.save()
        self.assertEqual(len(self.catalog['qualifications']),1);self.assertEqual(self.catalog['memberships'][0]['desired_monthly_count'],0)
    def test_failure_does_not_show_saved_and_keeps_fields(self):
        self.open();self.fail_save='40001';self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="name"]').fill('Preservar formulário');self.page.locator('[name="display_name"]').fill('Preservar')
        self.page.locator('#schedule-editor button[type="submit"]').click();self.page.wait_for_selector('.schedule-error:not(:empty)')
        self.assertEqual(self.page.locator('[name="name"]').input_value(),'Preservar formulário')
        self.assertNotIn('confirmado pelo Supabase',self.page.locator('#app').inner_text());self.assertEqual(self.catalog['people'],[])
    def test_failed_loading_retry_is_not_empty_state(self):
        self.fail_catalog=True
        self.page.goto(self.base+'#schedule-setup');self.page.wait_for_selector('#schedule-login')
        self.page.locator('#schedule-login [name="email"]').fill('test@example.invalid');self.page.locator('#schedule-login [name="password"]').fill('correct-password');self.page.locator('#schedule-login button').click()
        self.page.wait_for_selector('#schedule-login button:not([disabled])');self.page.wait_for_timeout(200)
        self.assertEqual(self.page.locator('.schedule-list').count(),0)
        self.assertNotIn('Nenhum cadastro encontrado',self.page.locator('#app').inner_text())
        self.fail_catalog=False;self.page.get_by_role('button',name='Tentar novamente',exact=True).click();self.page.wait_for_selector('.schedule-tabs')
        self.assertIn('Nenhum cadastro encontrado',self.page.locator('#app').inner_text())
    def test_unsaved_navigation_cancel_and_discard(self):
        self.open();self.page.locator('[data-schedule-action="create"]').click();self.page.locator('[name="name"]').fill('Ainda não salvo')
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('nav [data-page="agendas"]').click()
        self.assertEqual(self.page.url.split('#')[-1],'schedule-setup');self.assertEqual(self.page.locator('[name="name"]').input_value(),'Ainda não salvo')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('nav [data-page="agendas"]').click()
        self.assertEqual(self.page.url.split('#')[-1],'agendas');self.assertEqual(self.catalog['people'],[])
    def test_scope_only_manager_login_does_not_unlock_cultos(self):
        self.role=None;self.catalog['is_admin']=False;self.catalog['departments']=self.catalog['departments'][:1]
        self.open();self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertTrue(self.page.locator('nav [data-page="programs"]').is_hidden());self.assertEqual(self.page.locator('[data-schedule-action="tab"][data-id="access"]').count(),0)
        self.create_person();self.assertEqual(len(self.catalog['people']),1)
        self.page.reload();self.page.wait_for_selector('.schedule-list');self.assertIn('Participante fictício',self.page.locator('.schedule-list').inner_text())
    def test_viewer_has_no_mutation_controls(self):
        self.catalog['is_admin']=False
        for d in self.catalog['departments']:d['can_manage']=False
        self.open();self.assertEqual(self.page.locator('[data-schedule-action="create"]').count(),0)
        for tab in ['departments','roles','memberships','availability']:
            self.tab(tab);self.assertEqual(self.page.locator('[data-schedule-action="create"]').count(),0)
    def test_manual_sources_stay_distinct_and_fifteen_sound_entries(self):
        self.open();self.tab('sources');self.assertIn('15 registros',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('tbody tr').count(),20)
        self.assertIn('Rafa e Raphael',self.page.locator('#app').inner_text());self.assertEqual(self.catalog['people'],[])
    def test_availability_manual_brazilian_dates_24_hour(self):
        self.open();self.create_person();self.tab('availability');self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="starts_on"]').fill('28/10/2026');self.page.locator('[name="ends_on"]').fill('29/10/2026')
        self.page.locator('[name="start_time"]').fill('14:05');self.page.locator('[name="end_time"]').fill('16:30');self.save()
        row=self.catalog['availability'][0];self.assertEqual(row['starts_on'],'2026-10-28');self.assertEqual(row['start_time'],'14:05')
        self.page.locator('[data-schedule-action="edit"]').click();self.assertEqual(self.page.locator('[name="starts_on"]').input_value(),'28/10/2026')
        self.assertEqual(self.page.locator('input[type="time"]').count(),0)
    def test_exact_account_lookup_does_not_authorize_until_saved(self):
        self.open();self.tab('access');self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="lookup_email"]').fill('person@example.invalid');self.page.get_by_role('button',name='Buscar conta existente',exact=True).click()
        self.page.wait_for_function("document.querySelector('[name=user_id]').value!==''")
        self.assertEqual(self.catalog['access'],[]);self.assertIn('nenhum acesso foi concedido',self.page.locator('.schedule-lookup-result').inner_text())
        self.save();self.assertEqual(self.catalog['access'][0]['access_level'],'viewer')
    def test_names_long_text_and_all_requested_viewports(self):
        self.catalog['people']=[{'id':str(uuid.uuid4()),'name':'NomeMuitoExtensoSemEspaços'*15,'display_name':'NomeMuitoExtensoSemEspaços'*15,'version':1,'active':True}]
        self.open()
        for width in [360,390,768,1024,1440]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':900});self.page.wait_for_timeout(60)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.page.locator('[data-schedule-action="edit"]').click()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.page.locator('[data-schedule-action="cancel"]').click()
    def test_field_names_keyboard_and_visible_focus(self):
        self.open();self.page.locator('[data-schedule-action="create"]').click()
        self.assertTrue(self.page.get_by_label('Nome completo',exact=True).evaluate('(el)=>el===document.activeElement'))
        self.page.keyboard.press('Tab');self.assertTrue(self.page.get_by_label('Nome de exibição',exact=True).evaluate('(el)=>el===document.activeElement'))
        self.assertEqual(self.page.locator('#schedule-editor input:not([type=checkbox])').count(),self.page.locator('#schedule-editor label input:not([type=checkbox])').count())
        focused=self.page.evaluate("(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none'||s.boxShadow!=='none'})()")
        self.assertTrue(focused)
    def test_logout_removes_catalog(self):
        self.open();self.create_person();self.page.locator('[data-schedule-action="logout"]').click();self.page.wait_for_selector('#schedule-login')
        self.assertNotIn('Participante fictício',self.page.locator('#app').inner_text())
    def test_configurable_department_create_edit_and_inactivate_same_id(self):
        self.open();self.tab('departments');self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="name"]').fill('Departamento futuro');self.page.locator('[name="code"]').fill('departamento-futuro');self.save()
        row=self.catalog['departments'][-1]
        self.page.locator('[data-schedule-action="edit"][data-id="department:'+row['id']+'"]').click()
        self.page.locator('[name="name"]').fill('Departamento configurado');self.page.get_by_label('Cadastro ativo',exact=True).uncheck();self.save()
        self.assertEqual(len(self.catalog['departments']),3);self.assertEqual(self.catalog['departments'][-1]['id'],row['id']);self.assertFalse(self.catalog['departments'][-1]['active'])
    def test_same_person_added_to_second_department(self):
        self.open();self.create_person();self.tab('memberships');self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="department_id"]').select_option(E);self.save()
        self.assertEqual(len(self.catalog['people']),1);self.assertEqual(len(self.catalog['memberships']),2)
        self.assertEqual({m['department_id'] for m in self.catalog['memberships']},{D,E})
    def test_weekly_availability_and_no_assumed_service_time(self):
        self.open();self.create_person();self.tab('availability');self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="pattern"]').select_option('weekly');self.page.get_by_label('Sábado',exact=True).check();self.save()
        rule=self.catalog['availability'][0];self.assertEqual(rule['weekdays'],[6]);self.assertIsNone(rule['start_time']);self.assertIsNone(rule['end_time'])
    def test_server_unavailable_retry_keeps_form_and_same_request(self):
        self.open();self.fail_save='40001';self.page.locator('[data-schedule-action="create"]').click()
        self.page.locator('[name="name"]').fill('Salvar após tentar novamente');self.page.locator('[name="display_name"]').fill('Tentativa')
        self.page.locator('#schedule-editor button[type="submit"]').click();self.page.wait_for_selector('.schedule-error:not(:empty)')
        original=json.loads([body for name,body in self.requests if name=='iasdpi_schedule_save'][-1])
        self.fail_save=None;self.save()
        retry=json.loads([body for name,body in self.requests if name=='iasdpi_schedule_save'][-1])
        self.assertEqual(original['p_request_id'],retry['p_request_id']);self.assertEqual(original['p_id'],retry['p_id'])
