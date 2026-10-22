"""24 horas em navegador en-US, fuso estrangeiro e dados exclusivamente fictícios."""
import copy
import json
import shutil
import unittest
from unittest.mock import patch

import test_frontend_access as base
import test_operational_browser as operational
import test_registration_backend as local_backend


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class HourFormatBrowserTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    supabase=operational.OperationalBrowserTests.supabase
    save=operational.OperationalBrowserTests.save

    def setUp(self):
        factory=self.browser.new_context
        with patch.object(self.browser,'new_context',side_effect=lambda **options:factory(locale='en-US',timezone_id='America/Los_Angeles',**options)):
            operational.OperationalBrowserTests.setUp(self)
        plan=copy.deepcopy(self.models[0]['plan']);plan.update(date='2026-10-10',name='Culto 24 horas')
        record={'id':'clock-fixture','version':1,'execution_mode':'manual','status':'Finalizada','plan':plan,'executions':{},'actual_details':{},'extra_events':[],'note':'Preservar','incident':'','planned_start':'2026-10-10T09:30:00-03:00','planned_end':'2026-10-10T11:24:00-03:00'}
        for item in plan['items']:
            item['planned_start']='2026-10-10T'+item['start']+':00-03:00';item['planned_end']='2026-10-10T'+item['end']+':00-03:00'
            record['executions'][item['id']]={'started':item['planned_start'],'ended':item['planned_end']}
            item['start']+=':00';item['end']+=':00'
        self.parent=plan['items'][0]['id']
        record['executions'][self.parent]={'started':'2026-10-10T09:30:12.123456-03:00','ended':'2026-10-10T09:35:15.654321-03:00'}
        record['actual_details'][self.parent]={'responsible':'Equipe','note':'Nota','subactivities':[{'id':'child-clock','parent_id':self.parent,'title':'Detalhe','start':'09:31:20.123456','end':'09:32:20.654321','responsible':'Equipe','note':'Subatividade'}]}
        plan['start']+=':00';plan['end']+=':00'
        self.records[record['id']]=record

    def enter(self):
        self.role='admin';self.open();self.login();self.page.wait_for_function('() => IASDPIAuth.allowed() && !state.busy && !bootInProgress && state.programs.length===1')
        self.assertEqual(self.page.evaluate('navigator.language'),'en-US')

    def assert24(self):
        self.assertNotRegex(self.page.locator('#app').inner_text(),r'\b(?:AM|PM)\b')
        self.assertEqual(self.page.locator('input[type="time"]').count(),0)

    def test_planning_inputs_are_text_24h_validate_and_reopen(self):
        self.enter();self.page.evaluate('navigate("edit");state.selected=null;render()')
        form=self.page.locator('#program-form');row=form.locator('.item-editor').first
        form.locator('.form-grid [name="name"]').fill('Planejamento de teste')
        form.locator('.form-grid [name="date"]').fill('22/10/2026')
        form.locator('.form-grid [name="start"]').fill('24:00')
        form.locator('.form-grid [name="end"]').fill('14:00')
        row.locator('[name="activity"]').fill('Atividade de teste')
        row.locator('[name="start"]').fill('13:00');row.locator('[name="end"]').fill('14:00')
        self.assert24()
        fields=form.locator('[data-planned-time]').evaluate_all('(fields)=>fields.map(f=>({type:f.type,value:f.value,max:f.maxLength}))')
        self.assertTrue(all(f['type']=='text' and f['max']==5 for f in fields))
        form.locator('[type="submit"]').click();self.page.wait_for_selector('.field-error')
        self.assertIn('HH:mm',self.page.locator('.field-error').first.inner_text());self.assertEqual(len(self.records),1)
        form.locator('.form-grid [name="start"]').fill('13:00');form.locator('[type="submit"]').click()
        self.page.wait_for_function('() => !state.busy && state.programs.length===2')
        saved=next(p for p in self.records.values() if p['id']!='clock-fixture')
        self.assertEqual(saved['plan']['start'],'13:00');self.assertEqual(saved['plan']['items'][0]['end'],'14:00')
        self.page.reload();self.page.wait_for_function('(id) => !bootInProgress && IASDPIAuth.allowed() && state.programs.some(p=>p.id===id)',arg=saved['id'])
        self.page.evaluate('(id)=>navigate("edit",id)',saved['id']);self.page.wait_for_selector('#program-form')
        self.assertEqual(self.page.locator('#program-form .form-grid [name="start"]').input_value(),'13:00')
        self.assert24()

    def test_all_record_screens_format_without_writing_or_changing_metrics(self):
        before=copy.deepcopy(self.records);self.enter()
        baseline=self.page.evaluate('JSON.stringify(executionInfo(state.programs[0]))')
        for page in ('programs','home','history','summary','actuals'):
            self.page.evaluate('(page)=>navigate(page,"clock-fixture")',page)
            self.assert24()
            self.assertIn('09:30',self.page.locator('#app').inner_text())
            if page in ('actuals','summary'):
                self.assertIn('09:30 → 09:35',self.page.locator('#app').inner_text())
                self.assertIn('09:30:12',self.page.locator('#app').inner_text() if page=='summary' else self.page.locator('.actual-row').first.locator('[name="start"]').input_value())
        self.page.evaluate('''() => {const p=state.programs[0];trashState.rows=[];trashState.detail={id:p.id,version:p.version,document:p,deleted_at:'2026-10-22T17:01:23Z',deleted_by:'admin-test',deletion_reason:'Teste',audit:[]};navigate('trash');}''')
        self.assert24();self.assertIn('14:01:23',self.page.locator('#app').inner_text())
        self.assertIn('09:30 → 09:35',self.page.locator('#app').inner_text())
        self.page.evaluate('''() => {const p=structuredClone(state.programs[0]);p.execution_mode='live';p.status='Em andamento';p.executions={[p.plan.items[0].id]:{started:'2026-10-10T09:30:12-03:00',ended:null}};app.innerHTML=tracking(p);}''')
        self.assert24();self.assertIn('09:30 → 09:35',self.page.locator('.current-details').inner_text())
        self.assertEqual(self.records,before)
        self.assertEqual(self.page.evaluate('JSON.stringify(executionInfo(state.programs[0]))'),baseline)

    def test_save_note_keeps_absolute_and_child_microseconds_and_reopens(self):
        before=copy.deepcopy(self.records['clock-fixture']);self.enter()
        self.page.evaluate('navigate("actuals","clock-fixture")');row=self.page.locator('.actual-row').first
        self.assertEqual(row.locator('[name="start"]').input_value(),'09:30:12')
        self.assertEqual(row.locator('[name="sub-start"]').input_value(),'09:31:20')
        row.locator('[name="activity-note"]').fill('Edição de nota');self.save()
        saved=self.records['clock-fixture']
        self.assertEqual(saved['executions'],before['executions'])
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'],before['actual_details'][self.parent]['subactivities'])
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'09:30:12')
        self.assert24();self.assertEqual(len(self.records),1)

    def test_midnight_now_uses_sao_paulo_seconds_under_us_browser(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.clock.set_fixed_time('2026-10-22T03:00:05Z')
        self.page.locator('.actual-row').first.locator('[data-action="time-now"][data-field="start"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'00:00:05')
        self.assertEqual(self.page.evaluate("displayPlannedTime('2018-01-20T11:05:06Z')"),'09:05')
        self.assertEqual(self.page.evaluate("displayRecordTimestamp('2026-10-22T03:00:05.123456Z')"),'22/10/2026 00:00:05')

    def test_agenda_archives_and_admin_timestamps_use_24_hours(self):
        before=copy.deepcopy(self.records);self.enter()
        self.page.evaluate('''() => {const event={id:'event',title:'Reunião',department:'Comunicação',start:'2026-10-22T16:05:35Z',end:'2026-10-22T17:10:45Z',startDate:'2026-10-22',endDate:'2026-10-22',sourceIds:['event']};app.innerHTML=agendaEventList([event],[event]);}''')
        self.assert24();self.assertIn('13:05 → 14:10',self.page.locator('#app').inner_text())
        self.page.evaluate("cloudState.archives=[{id:'archive',created_at:'2026-10-22T17:05:35Z'}];app.innerHTML=archivePage()")
        self.assert24();self.assertIn('22/10/2026 14:05:35',self.page.locator('#app').inner_text())
        self.page.evaluate("usersState.invites=[{id:'invite',email:'test@example.invalid',expires_at:'2026-10-22T17:05:35Z'}];app.innerHTML=usersPage()")
        self.assert24();self.assertIn('22/10/2026 14:05:35',self.page.locator('#app').inner_text())
        self.assertEqual(self.records,before)


class BackendClockFormatTests(unittest.TestCase):
    def test_historical_sao_paulo_offset_and_precision_without_database(self):
        server=local_backend.server
        self.assertEqual(server.actual_instant('2018-01-20','09:30:12.123456'),'2018-01-20T09:30:12.123456-02:00')
        self.assertEqual(server.actual_instant('2018-07-21','09:30:12'),'2018-07-21T09:30:12-03:00')
        old='2018-01-20T09:30:12.123456-02:00'
        self.assertEqual(server.preserve_actual('2018-01-20','09:30:12.123456',old,'2018-01-20'),old)
