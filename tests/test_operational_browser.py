"""Integração UI/REST simulado, contextos de navegador independentes e dados descartáveis."""
import copy
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from urllib.parse import urlsplit,parse_qs

import test_frontend_access as base
import test_pages_release as pages


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class OperationalBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory=tempfile.TemporaryDirectory(prefix='iasdpi-operational-ui-')
        site=Path(cls.directory.name)/'Avaliacoes_mentorama_SQL'
        pages.builder.build(site,'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/',preserve_local=True,operational=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.directory.name))
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.http.server_port)+'/Avaliacoes_mentorama_SQL/'
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        base.FrontendAccessTests.tearDownClass.__func__(cls);cls.directory.cleanup()

    def setUp(self):
        self.records={};self.receipts={};self.fail_write=False;self.drop_response=False
        model=json.loads((base.ROOT/'backend/chronogram.json').read_text())
        self.models=[{'id':'liturgy-i','display_name':'Liturgia I — Padrão','version':1,'plan':model},
                     {'id':'free','display_name':'Livre — Sem atividades','version':1,'plan':{'name':'Culto livre','start':'','end':'','items':[],'team':{},'template_id':'free'}}]
        base.FrontendAccessTests.setUp(self)

    tearDown=base.FrontendAccessTests.tearDown
    open=base.FrontendAccessTests.open
    login=base.FrontendAccessTests.login

    def supabase(self,route):
        request=route.request;url=urlsplit(request.url);path=url.path;query=parse_qs(url.query)
        if path=='/rest/v1/iasdpi_templates':
            selected=query.get('id',[''])[0].removeprefix('eq.')
            rows=[m for m in self.models if not selected or m['id']==selected or selected=='culto-03102026' and m['id']=='liturgy-i']
            return route.fulfill(json=rows)
        if path=='/rest/v1/iasdpi_programs':
            identifier=query.get('id',[''])[0].removeprefix('eq.')
            values=[p for key,p in self.records.items() if not identifier or key==identifier]
            return route.fulfill(json=[{'document':p} for p in values])
        if path=='/rest/v1/rpc/iasdpi_save_program':
            data=request.post_data_json
            if self.fail_write:return route.abort('failed')
            key=data['p_id'];old=self.records.get(key);requestid=data['p_request_id']
            if requestid in self.receipts:return route.fulfill(json=self.receipts[requestid])
            if data['p_import'] and old:
                same={k:v for k,v in old.items() if k!='version'}=={k:v for k,v in data['p_document'].items() if k!='version'}
                if same:return route.fulfill(json={'status':'exists','document':old})
            if old and old['version']!=data['p_expected_version']:
                return route.fulfill(status=409,json={'code':'40001','message':'Registro alterado em outro dispositivo.'})
            if data['p_import'] and old:return route.fulfill(status=409,json={'code':'40001','message':'Conflito de importação.'})
            document=copy.deepcopy(data['p_document']);document['version']=data['p_expected_version']+1;self.records[key]=document
            result={'status':'imported' if data['p_import'] else 'saved','document':document};self.receipts[requestid]=result
            if self.drop_response:self.drop_response=False;return route.abort('failed')
            return route.fulfill(json=result)
        if path=='/rest/v1/rpc/iasdpi_preview_import':
            return route.fulfill(json=[{'id':p['id'],'name':p['plan']['name'],'date':p['plan']['date'],'status':'conflict' if p['id'] in self.records else 'new'} for p in request.post_data_json['p_documents']])
        return base.FrontendAccessTests.supabase(self,route)

    def begin(self,model='liturgy-i'):
        self.open();self.login();self.page.wait_for_function('() => IASDPIAuth.allowed() && !state.busy')
        self.page.locator('nav [data-page="actuals"]').click();self.page.wait_for_selector('#new-record-form')
        self.page.locator('[name="template-id"]').select_option(model)
        self.page.locator('#new-record-form button').click();self.page.wait_for_selector('#actuals-form')
        self.page.wait_for_function('() => !state.busy')
        return self.page.evaluate('selected().id')

    def save(self):
        self.page.locator('#actuals-form [name="save"]').click();self.page.wait_for_function('() => !state.busy')

    def test_create_models_current_date_and_persist_reload_without_local_storage_write(self):
        identifier=self.begin();self.assertIn(identifier,self.records)
        self.assertEqual(len(self.records[identifier]['plan']['items']),16)
        self.assertEqual(self.records[identifier]['plan']['date'],self.page.evaluate('saoPauloToday()'))
        row=self.page.locator('.actual-row').first
        self.assertEqual(row.locator('[name="start"]').get_attribute('maxlength'),'8')
        row.locator('[name="start"]').fill('09:30:00');row.locator('[name="end"]').fill('09:35:00');row.locator('[name="activity-note"]').fill('Nota no banco')
        self.save();self.assertIn('Supabase',self.page.locator('#registration-save-status').inner_text())
        self.assertEqual(self.records[identifier]['version'],2)
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),self.raw)
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'09:30:00')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Nota no banco')
        self.assertEqual(self.page.locator('[name="activity-status"]').count(),0)
        # Outro perfil, sem copiar localStorage operacional.
        second=self.browser.new_context();second.route('https://*.supabase.co/**',self.supabase)
        page=second.new_page();page.goto(self.base+'#login')
        page.locator('[name="email"]').fill('test@example.invalid');page.locator('[name="password"]').fill('correct-password');page.locator('#auth-login-form button').click()
        page.wait_for_function('() => state.programs.length===1 && !state.busy')
        self.assertEqual(page.evaluate('selected()?.id||state.programs[0].id'),identifier)
        self.assertIsNone(page.evaluate('localStorage.getItem("iasdpi-demo-v1")'));second.close()

    def test_free_no_activities_now_24h_and_date_edit(self):
        identifier=self.begin('free');self.assertEqual(self.records[identifier]['plan']['items'],[])
        self.page.locator('[name="record-date"]').fill('24/10/2026');self.save()
        self.assertEqual(self.records[identifier]['plan']['date'],'2026-10-24')
        self.assertEqual(len(self.records),1)

    def test_seconds_required_now_parent_and_child_and_history_format(self):
        identifier=self.begin();row=self.page.locator('.actual-row').first
        row.locator('[name="start"]').fill('09:30')
        self.save();self.assertEqual(self.records[identifier]['version'],1)
        self.assertIn('segundos',self.page.locator('.field-error').inner_text())
        self.page.evaluate("state.offset=new Date('2026-10-22T17:05:35.100Z').getTime()-Date.now()")
        row.locator('[data-action="time-now"][data-field="start"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(row.locator('[name="start"]').input_value(),'14:05:35')
        row.locator('[name="end"]').fill('14:10:45')
        row.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('() => !state.busy')
        child=row.locator('.subactivity').first
        child.locator('[name="sub-title"]').fill('Detalhe de teste')
        child.locator('[data-action="time-now"][data-field="sub-start"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(child.locator('[name="sub-start"]').input_value(),'14:05:35')
        child.locator('[name="sub-end"]').fill('14:06:15');self.save()
        parent=self.records[identifier]['plan']['items'][0]['id']
        self.assertIn('T14:05:35-',self.records[identifier]['executions'][parent]['started'])
        self.page.evaluate('navigate("summary",selected().id)')
        text=self.page.locator('#app').inner_text()
        self.assertIn('14:05:35',text);self.assertIn('14:06:15',text)
        self.assertNotRegex(text,r'\b(?:AM|PM)\b')
        self.assertEqual(self.records[identifier]['plan']['items'][0]['start'],'09:30')

    def test_live_tracking_and_timeline_show_seconds_and_hide_fraction(self):
        identifier=self.begin();program=self.records[identifier]
        program['execution_mode']='live';program['status']='Em andamento'
        parent=program['plan']['items'][0]['id']
        day=program['plan']['date']
        program['executions'][parent]={'started':day+'T09:30:12.123456-03:00','ended':None}
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.page.evaluate('navigate("tracking",selected().id)')
        self.assertIn('09:30:12',self.page.locator('.current-details').inner_text())
        self.assertIn('09:30:12',self.page.locator('.timeline-row').first.inner_text())
        self.assertNotIn('.123456',self.page.locator('#app').inner_text())
        self.assertRegex(self.page.locator('[data-live="clock"]').inner_text(),r'^\d{2}:\d{2}:\d{2}$')
        self.assertEqual(self.records[identifier]['executions'][parent]['started'],day+'T09:30:12.123456-03:00')

    def test_connection_failure_keeps_fields_pending_recovery_and_no_false_success(self):
        identifier=self.begin();self.fail_write=True
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Não perder')
        self.save();self.assertEqual(self.records[identifier]['version'],1)
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Não perder')
        self.assertIn('não',self.page.locator('.form-error').inner_text().lower())
        self.assertTrue(self.page.evaluate('registrationDirty'))
        self.fail_write=False;self.save()
        self.assertEqual(self.records[identifier]['version'],2)
        self.assertEqual(len(self.records),1)

    def test_lost_create_response_retry_is_idempotent(self):
        self.open();self.login();self.page.wait_for_function('() => IASDPIAuth.allowed() && !state.busy')
        self.page.locator('nav [data-page="actuals"]').click();self.page.wait_for_selector('#new-record-form')
        self.drop_response=True;self.page.locator('#new-record-form button').click();self.page.wait_for_selector('.form-error')
        self.page.wait_for_function('() => !state.busy');self.assertEqual(len(self.records),1)
        self.page.locator('#new-record-form button').click();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(len(self.records),1)

    def test_conflict_does_not_overwrite_other_device_and_keeps_draft(self):
        identifier=self.begin();self.records[identifier]['version']=2;self.records[identifier]['note']='Outra pessoa'
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Rascunho')
        self.save();self.assertEqual(self.records[identifier]['note'],'Outra pessoa')
        self.assertEqual(self.records[identifier]['version'],2)
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Rascunho')
        self.assertTrue(self.page.evaluate('registrationDirty'))

    def test_pending_write_recovered_after_reload_and_second_display_preserves_precision(self):
        identifier=self.begin();parent=self.records[identifier]['plan']['items'][0]['id']
        self.records[identifier]['executions'][parent]={'started':self.records[identifier]['plan']['date']+'T09:30:12.123456-03:00','ended':self.records[identifier]['plan']['date']+'T09:35:23.654321-03:00'}
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        row=self.page.locator('.actual-row').first
        self.assertEqual(row.locator('[name="start"]').input_value(),'09:30:12')
        self.assertEqual(row.locator('[name="end"]').input_value(),'09:35:23')
        original=copy.deepcopy(self.records[identifier]['executions'])
        row.locator('[name="activity-note"]').fill('Recuperar após fechar')
        self.fail_write=True;self.save()
        self.page.once('dialog',lambda dialog:dialog.accept());self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.fail_write=False
        self.page.locator('nav [data-page="archive"]').click();self.page.wait_for_selector('[data-action="operational-pending"]')
        self.page.locator('[data-action="operational-pending"]').click();self.page.wait_for_selector('[data-action="operational-retry"]')
        self.page.locator('[data-action="operational-retry"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.records[identifier]['actual_details'][parent]['note'],'Recuperar após fechar')
        self.assertEqual(self.records[identifier]['executions'],original)
        self.assertEqual(self.records[identifier]['version'],2)

    def test_subactivity_crud_does_not_change_plan_or_duration(self):
        identifier=self.begin();row=self.page.locator('.actual-row').first
        row.locator('[name="start"]').fill('09:30:00');row.locator('[name="end"]').fill('09:35:00');self.save()
        plan=copy.deepcopy(self.records[identifier]['plan'])
        baseline=self.page.evaluate('JSON.stringify(executionInfo(selected()))')
        row.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('() => !state.busy')
        child=self.page.locator('.subactivity').first
        child.locator('[name="sub-title"]').fill('Detalhe')
        child.locator('[name="sub-start"]').fill('09:31:00');child.locator('[name="sub-end"]').fill('09:34:00')
        self.save();parent=plan['items'][0]['id']
        self.assertEqual(len(self.records[identifier]['actual_details'][parent]['subactivities']),1)
        self.page.locator('.subactivity [name="sub-note"]').fill('Editar nota');self.save()
        self.page.once('dialog',lambda dialog:dialog.accept());self.page.locator('[data-action="remove-subactivity"]').click();self.page.wait_for_function('() => !state.busy')
        self.save();self.assertEqual(self.records[identifier]['actual_details'][parent]['subactivities'],[])
        self.assertEqual(self.records[identifier]['plan'],plan)
        self.assertEqual(self.page.evaluate('JSON.stringify(executionInfo(selected()))'),baseline)

    def test_import_preview_confirmation_and_local_copy_retained(self):
        self.begin('free');self.page.locator('nav [data-page="archive"]').click();self.page.wait_for_selector('[data-action="operational-preview"]')
        self.page.locator('[data-action="operational-preview"]').click();self.page.wait_for_selector('[data-import-id]')
        self.assertEqual(len(self.records),1)
        self.page.locator('[data-action="operational-import"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(len(self.records),2);self.assertIn('test-program',self.records)
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),self.raw)
