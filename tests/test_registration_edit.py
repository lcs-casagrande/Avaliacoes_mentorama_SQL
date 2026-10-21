"""Cópias descartáveis do formato existente; sem dados reais ou Supabase remoto."""
import copy
import json
import shutil
import unittest

import test_frontend_access as base
import test_pages_release as pages


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class RegistrationEditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pages.ExistingPagesTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        base.FrontendAccessTests.tearDownClass.__func__(cls)
        cls.directory.cleanup()

    setUp=base.FrontendAccessTests.setUp
    tearDown=base.FrontendAccessTests.tearDown
    open=base.FrontendAccessTests.open
    login=base.FrontendAccessTests.login
    supabase=base.FrontendAccessTests.supabase

    def open_record(self):
        self.open()
        p=json.loads(self.raw)[0]
        p['status']='Finalizada';p['plan']['date']='2026-10-10'
        # Nome de compatibilidade fictício: não altera o modelo real ou sua ordem.
        p['plan']['items'][7]['activity']='Doxologia I'
        for field in ['planned_start','planned_end']:
            p[field]=p[field].replace('2026-10-03','2026-10-10')
        for item in p['plan']['items']:
            for field in ['planned_start','planned_end']:
                item[field]=item[field].replace('2026-10-03','2026-10-10')
            p['executions'][item['id']]={'started':item['planned_start'],'ended':item['planned_end']}
            p['actual_details'][item['id']]={'note':'Observação preservada\nSegunda linha  ','responsible':'Equipe teste','legacy_detail':{'preserve':True}}
        p['extra_events']=[{'id':'legacy-extra','position':2,'activity':'Atividade extra antiga','start':'09:40:00','end':'09:41:00','responsible':'Equipe antiga','note':'Nota antiga','legacy_extra':'preservar'}]
        p['note']='Nota do culto';p['incident']='Ocorrência anterior'
        p['custom_record_metadata']={'preserve':True}
        self.original=copy.deepcopy(p);self.raw=json.dumps([p],ensure_ascii=False)
        self.page.evaluate('(raw)=>localStorage.setItem("iasdpi-demo-v1",raw)',self.raw)
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1 && !state.busy')
        self.page.evaluate('navigate("summary","test-program")')
        self.page.locator('[data-action="actuals"]').click()
        self.page.wait_for_selector('#actuals-form')
        self.page.wait_for_function('() => !state.busy')

    def record(self):
        return self.page.evaluate('JSON.parse(localStorage.getItem("iasdpi-demo-v1"))[0]')

    def save(self):
        version=self.record()['version']
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_function('(v)=>JSON.parse(localStorage.getItem("iasdpi-demo-v1"))[0].version>v && !state.busy',arg=version)

    def add_child(self,title='Detalhamento',start='',end=''):
        row=self.page.locator('.actual-row').first
        row.locator('[data-action="add-subactivity"]').click()
        self.page.wait_for_function('() => !state.busy')
        child=row.locator('.subactivity').last
        child.locator('[name="sub-title"]').fill(title)
        child.locator('[name="sub-responsible"]').fill('Responsável filho')
        child.locator('[name="sub-note"]').fill('Observação filha')
        if start:child.locator('[name="sub-start"]').fill(start)
        if end:child.locator('[name="sub-end"]').fill(end)
        return child

    def test_nested_crud_keeps_plan_duration_legacy_extras_and_id(self):
        self.open_record()
        baseline=self.page.evaluate('JSON.stringify(executionInfo(selected()))')
        transitions=self.page.evaluate('JSON.stringify(transitions(selected()))')
        self.assertEqual(self.page.locator('.actual-row').count(),17)
        self.assertIn('Doxologia I',self.page.locator('#actuals-form').inner_text())
        self.assertEqual(self.page.locator('[data-action="add-extra"]').count(),0)
        self.add_child(start='09:31:00',end='09:34:00')
        self.assertEqual(self.page.locator('.actual-row').count(),17)
        self.assertEqual(self.page.locator('.actual-row').first.locator('.subactivity').count(),1)
        self.save()
        p=self.record();parent=p['plan']['items'][0]['id']
        self.assertEqual(p['id'],self.original['id']);self.assertEqual(p['plan'],self.original['plan'])
        self.assertEqual(p['executions'],self.original['executions']);self.assertEqual(p['status'],'Finalizada')
        self.assertEqual(self.page.evaluate('JSON.stringify(executionInfo(selected()))'),baseline)
        self.assertEqual(self.page.evaluate('JSON.stringify(transitions(selected()))'),transitions)
        for key,value in self.original['extra_events'][0].items():self.assertEqual(p['extra_events'][0][key],value)
        self.assertEqual(p['actual_details'][parent]['legacy_detail'],{'preserve':True})
        self.assertEqual(p['actual_details'][parent]['note'],self.original['actual_details'][parent]['note'])
        self.assertEqual(p['custom_record_metadata'],self.original['custom_record_metadata'])
        self.assertEqual(p['actual_details'][parent]['subactivities'][0]['parent_id'],parent)
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('[name="sub-title"]').input_value(),'Detalhamento')
        self.page.locator('[name="sub-title"]').fill('Título editado');self.save()
        self.page.once('dialog',lambda d:d.dismiss())
        self.page.locator('[data-action="remove-subactivity"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.page.locator('.subactivity').count(),1)
        self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-action="remove-subactivity"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.save();self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.subactivity').count(),0)
        self.assertEqual(self.page.evaluate('state.programs.length'),1)
        self.assertEqual(self.record()['plan']['date'],'2026-10-10')

    def test_invalid_child_and_parent_interval_cannot_overwrite(self):
        self.open_record();self.add_child(start='09:29:59',end='09:34:00')
        self.page.locator('#actuals-form [name="save"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.record(),self.original)
        self.assertIn('intervalo',self.page.locator('#notice').inner_text())
        self.page.locator('[name="sub-start"]').fill('09:31:00')
        self.page.locator('.actual-row').first.locator('[name="end"]').fill('09:30:30')
        self.page.locator('#actuals-form [name="save"]').click();self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.record(),self.original)

    def test_optional_child_times_edit_real_time_metadata_and_reopen(self):
        self.open_record();self.add_child()
        self.page.locator('.actual-row').first.locator('[name="start"]').fill('09:30:17')
        self.page.locator('[name="record-name"]').fill('Culto revisado')
        self.page.locator('[name="record-info"]').fill('Informação adicional')
        self.save();p=self.record()
        self.assertEqual(p['plan']['items'],self.original['plan']['items'])
        self.assertEqual(p['id'],self.original['id']);self.assertEqual(p['plan']['name'],'Culto revisado')
        self.assertEqual(p['record_info'],'Informação adicional')
        parent=p['plan']['items'][0]['id']
        self.assertIn('09:30:17',p['executions'][parent]['started'])
        self.assertEqual(p['actual_details'][parent]['subactivities'][0]['start'],'')
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('[name="record-info"]').input_value(),'Informação adicional')
        self.assertIn('neste navegador',self.page.locator('#registration-save-status').inner_text())

    def test_cancel_and_rejected_navigation_preserve_unsaved_and_stored_data(self):
        self.open_record();self.add_child()
        self.assertIn('não salvas',self.page.locator('#registration-save-status').inner_text())
        self.page.once('dialog',lambda d:d.dismiss())
        self.page.locator('nav [data-page="history"]').click()
        self.assertEqual(self.page.locator('.subactivity').count(),1)
        self.assertEqual(self.record(),self.original)
        self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-action="cancel-record"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.record(),self.original)
        self.assertEqual(self.page.locator('.subactivity').count(),0)

    def test_backup_roundtrip_keeps_children_and_rejects_bad_parent(self):
        self.open_record();self.add_child(start='09:31:00');self.save()
        outcome=self.page.evaluate('''async()=>{const data=await backupPayload();const secured=await encryptBackup(data,'backup-password-test');const restored=await decryptBackup(secured,'backup-password-test');const valid=JSON.stringify(data)===JSON.stringify(restored);const child=restored.programs[0].actual_details[restored.programs[0].plan.items[0].id].subactivities[0];child.parent_id='other-parent';let denied=false;try{backupValidate(restored);}catch(_){denied=true;}return {valid,denied};}''')
        self.assertEqual(outcome,{'valid':True,'denied':True})

    def test_not_performed_status_can_finalize_without_fake_times(self):
        self.open_record();row=self.page.locator('.actual-row').first
        row.locator('[name="start"]').fill('');row.locator('[name="end"]').fill('')
        row.locator('[name="activity-status"]').select_option('nao_realizada')
        self.page.locator('#actuals-form [name="finalize"]').click()
        self.page.wait_for_function('() => !state.busy && state.page==="summary"')
        p=self.record();parent=p['plan']['items'][0]['id']
        self.assertEqual(p['actual_details'][parent]['status'],'nao_realizada')
        self.assertNotIn(parent,p['executions']);self.assertEqual(len(p['plan']['items']),16)

    def test_concurrent_edits_use_same_identifier_and_reject_stale_version(self):
        self.open_record()
        outcome=self.page.evaluate('''async()=>{
          const p=selected(),records=Object.fromEntries(p.plan.items.map(i=>[i.id,{start:actualClock(p.executions[i.id]?.started),end:actualClock(p.executions[i.id]?.ended)}]));
          const body={version:p.version,executions:records};
          const result=await Promise.allSettled([api('programs/'+p.id+'/actuals','PUT',{...body,note:'Primeira gravação'}),api('programs/'+p.id+'/actuals','PUT',{...body,note:'Gravação concorrente'})]);
          const stored=JSON.parse(localStorage.getItem('iasdpi-demo-v1'));
          return {results:result.map(r=>r.status),count:stored.length,id:stored[0].id,version:stored[0].version};
        }''')
        self.assertEqual(sorted(outcome['results']),['fulfilled','rejected'])
        self.assertEqual(outcome['count'],1);self.assertEqual(outcome['id'],self.original['id'])
        self.assertEqual(outcome['version'],2)
