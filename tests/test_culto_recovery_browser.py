"""Regressão de importação e lixeira no pacote estático, REST simulado."""
import copy
import json
import shutil
import unittest
from urllib.parse import urlsplit

import test_frontend_access as base
import test_operational_browser as operational


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class CultoRecoveryBrowserTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    save=operational.OperationalBrowserTests.save

    def setUp(self):
        self.trash={};self.trash_calls=[]
        operational.OperationalBrowserTests.setUp(self)
        plan=copy.deepcopy(self.models[0]['plan']);plan['date']='2026-10-10';plan['name']='Culto · Liturgia I'
        self.imported={'id':'imported-pdf','version':8,'status':'Em andamento','execution_mode':'manual','plan':plan,'executions':{},'actual_details':{},'note':'Nota preservada','incident':'Ocorrência','record_info':'Complemento','extra_events':[]}
        plan['team']=None
        for index,item in enumerate(plan['items']):
            item.pop('planned_start',None);item.pop('planned_end',None)
            self.imported['executions'][item['id']]={'started':item['start']+':00','ended':'2026-10-10 '+item['end']+':00-03'}
            self.imported['actual_details'][item['id']]={'note':'Nota '+str(index),'responsible':'Equipe '+str(index),'status':'realizada','unknown':'Preservar'}
            item['start']+=':00';item['end']+=':00'
        parent=plan['items'][0]['id'];self.parent=parent
        self.imported['executions'][parent]['started']='09:??'
        self.imported['executions'][plan['items'][1]['id']]['started']='2026-10-10T09:35:00.123456-03:00'
        self.imported['actual_details'][parent]['subactivities']=[{'id':'child-old','parent_id':parent,'title':'Detalhe','start':'09:31:00','end':'09:32:00','responsible':'Equipe','note':'Filho'}]
        plan['start']+=':00';plan['end']+=':00'
        self.records[self.imported['id']]=copy.deepcopy(self.imported)
        draft=copy.deepcopy(self.imported);draft.update(id='draft-test',version=1,status='Planejamento',executions={},actual_details={},note='',incident='',record_info='')
        draft['plan'].update(date='2026-10-22',name='Culto de sábado')
        self.records['draft-test']=draft

    def supabase(self,route):
        path=urlsplit(route.request.url).path
        if path.startswith('/rest/v1/rpc/iasdpi_') and any(path.endswith(x) for x in ('list_trash','trash_detail','trash_program','restore_program')):
            data=route.request.post_data_json;self.trash_calls.append((path,data))
            if self.role!='admin':return route.fulfill(status=403,json={'code':'42501','message':'Acesso administrativo necessário.'})
            if path.endswith('list_trash'):return route.fulfill(json=list(self.trash.values())[data['p_offset']:data['p_offset']+100])
            if path.endswith('trash_detail'):return route.fulfill(json=self.trash[data['p_id']])
            restore=path.endswith('restore_program');key=data['p_id']
            doc=self.trash[key]['document'] if restore else self.records[key]
            if doc['version']!=data['p_expected_version']:return route.fulfill(status=409,json={'code':'40001','message':'Registro alterado em outro dispositivo.'})
            doc=copy.deepcopy(doc);doc['version']+=1
            if restore:self.records[key]=doc;del self.trash[key]
            else:
                self.trash[key]={'id':key,'version':doc['version'],'document':doc,'deleted_at':'2026-10-22T17:01:23Z','deleted_by':base.USER,'deleted_by_email':'test@example.invalid','deletion_reason':data.get('p_reason'),'audit':[]}
                del self.records[key]
            return route.fulfill(json={'status':'restored' if restore else 'trashed','document':doc})
        return operational.OperationalBrowserTests.supabase(self,route)

    def enter(self,role='leader'):
        self.role=role;self.open();self.login();self.page.wait_for_function('() => IASDPIAuth.allowed() && !state.busy')
        self.page.locator('nav [data-page="programs"]').click()

    def open_imported(self):
        self.enter()
        self.page.locator('[data-action="actuals"][data-id="imported-pdf"]').click()
        self.page.wait_for_selector('#actuals-form')

    def test_imported_clocks_invalid_field_16_items_and_manual_save_finalize_same_id(self):
        before=copy.deepcopy(self.records)
        self.open_imported()
        self.assertEqual(self.page.locator('.actual-row').count(),16)
        row=self.page.locator('.actual-row').first
        self.assertEqual(row.locator('[name="start"]').input_value(),'09:??')
        self.assertIn('importado inválido',row.locator('.field-error').inner_text())
        self.assertNotIn('Invalid time value',self.page.locator('#app').inner_text())
        self.assertEqual(self.records,before) # Opening never writes to server.
        row.locator('[name="start"]').fill('09:30:00');self.save()
        saved=self.records['imported-pdf'];self.assertEqual(saved['version'],9)
        self.assertEqual(len(self.records),2);self.assertEqual(len(saved['plan']['items']),16)
        second=saved['plan']['items'][1]['id']
        self.assertEqual(saved['executions'][second]['started'],before['imported-pdf']['executions'][second]['started'])
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'],before['imported-pdf']['actual_details'][self.parent]['subactivities'])
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'09:30:00')
        self.page.locator('#actuals-form [name="finalize"]').click();self.page.wait_for_function('() => !state.busy && state.page==="summary"')
        self.assertEqual(self.records['imported-pdf']['status'],'Finalizada')
        self.assertEqual(self.records['imported-pdf']['id'],'imported-pdf')
        self.assertIn('10/10/2026',self.page.locator('#app').inner_text())
        self.page.locator('nav [data-page="history"]').click()
        self.assertIn('10/10/2026',self.page.locator('#app').inner_text());self.assertEqual(len(self.records),2)
        self.assertEqual(self.records['draft-test'],before['draft-test'])

    def test_view_program_optional_nulls_and_missing_dates_no_whole_screen_exception(self):
        self.records['imported-pdf'].update(planned_start=None,planned_end='não informado')
        self.records['imported-pdf']['plan']['date']='data desconhecida'
        self.enter();self.page.locator('[data-action="edit"][data-id="imported-pdf"]').click();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').count(),16)
        self.assertIn('Data inconsistente',self.page.locator('#app').inner_text())
        self.assertEqual(self.records['imported-pdf']['plan']['date'],'data desconhecida')

    def test_admin_trash_details_restore_and_other_culto_unchanged(self):
        before=copy.deepcopy(self.records['imported-pdf']);self.enter('admin')
        self.assertEqual(self.trash_calls,[])
        responses=iter([None,'Teste descartável'])
        self.page.on('dialog',lambda dialog:dialog.accept(next(responses)))
        self.page.locator('[data-action="trash-move"][data-id="draft-test"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertNotIn('draft-test',self.records);self.assertIn('draft-test',self.trash)
        self.assertEqual(self.records['imported-pdf'],before)
        self.page.locator('[data-action="trash-open"]').click();self.page.wait_for_selector('[data-action="trash-detail"]')
        self.page.locator('[data-action="trash-detail"]').click();self.page.wait_for_selector('[data-action="trash-close"]')
        self.assertIn('Teste descartável',self.page.locator('#app').inner_text())
        self.assertIn('test@example.invalid',self.page.locator('#app').inner_text())
        # One further confirmation (restore), no reason prompt.
        responses=iter([None])
        self.page.locator('[data-action="trash-restore"]').first.click();self.page.wait_for_function('() => !state.busy')
        self.assertIn('draft-test',self.records);self.assertNotIn('draft-test',self.trash)
        self.assertEqual(self.records['imported-pdf'],before)
        self.assertEqual(self.records['draft-test']['version'],3)

    def test_leader_cannot_access_trash_even_via_direct_action_or_rpc(self):
        self.enter()
        self.assertEqual(self.page.locator('[data-action="trash-move"]').count(),0)
        self.assertFalse(self.page.locator('nav [data-page="trash"]').is_visible())
        self.page.evaluate('navigate("trash")')
        self.assertIn('Acesso administrativo necessário',self.page.locator('#app').inner_text())
        self.assertTrue(self.page.evaluate('async()=>{try{await handleTrashAction("trash-restore","draft-test");return false;}catch(_){return true;}}'))
        self.assertEqual(self.trash_calls,[])

    def test_time_parser_validates_historical_zone_dates_and_keeps_invalid_values(self):
        self.open_imported()
        value=self.page.evaluate('''() => ({
          summer:recordInstant('2018-01-20','09:30:12.123456'),winter:recordInstant('2018-07-21','09:30:12'),
          impossible:inspectRecordTime('2026-02-30T09:30:00Z').valid,
          malformed:displayActualTime('valor do PDF'),seconds:displayActualTime('09:30:00.123456'),
          full:displayActualTime('2026-10-10 12:30:15.123456+00'),unknown:recordEpoch('09:??','2026-10-10'),
          untouched:JSON.stringify(selected())===JSON.stringify(state.programs.find(p=>p.id==='imported-pdf'))
        })''')
        self.assertTrue(value['summer'].endswith('-02:00'));self.assertTrue(value['winter'].endswith('-03:00'))
        self.assertFalse(value['impossible']);self.assertEqual(value['malformed'],'valor do PDF')
        self.assertEqual(value['seconds'],'09:30:00');self.assertEqual(value['full'],'09:30:15')
        self.assertIsNone(value['unknown']);self.assertTrue(value['untouched'])

    def test_live_next_activity_uses_stable_id_after_time_normalization(self):
        self.enter('admin')
        self.page.evaluate("""() => {const p=state.programs.find(p=>p.id==='imported-pdf');p.execution_mode='live';p.executions={[p.plan.items[0].id]:{started:'09:30:00',ended:null}};navigate('tracking',p.id);}""")
        expected=self.imported['plan']['items'][1]['activity']
        self.assertIn(expected,self.page.locator('[data-next]').inner_text())
        self.assertTrue(self.page.evaluate("planView(state.programs.find(p=>p.id==='imported-pdf')).includes('Equipe')"))

    def test_wrong_timestamp_day_requires_explicit_correction_even_when_clock_is_same(self):
        self.records['imported-pdf']['executions'][self.parent]['started']='2026-10-09T09:30:00-03:00'
        self.open_imported();row=self.page.locator('.actual-row').first
        self.assertIn('outra data',row.locator('.field-error').inner_text())
        self.save();self.assertEqual(self.records['imported-pdf']['version'],8)
        row.locator('[name="start"]').fill('09:30:00');self.save()
        saved=self.records['imported-pdf']
        self.assertEqual(saved['version'],9)
        self.assertTrue(saved['executions'][self.parent]['started'].startswith('2026-10-10T09:30:00'))
        self.assertEqual(len(self.records),2)
