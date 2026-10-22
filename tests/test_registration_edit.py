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

    def test_status_removed_partial_save_and_finalize_validation(self):
        self.open_record();row=self.page.locator('.actual-row').first
        self.assertEqual(self.page.locator('[name="activity-status"]').count(),0)
        row.locator('[name="start"]').fill('');row.locator('[name="end"]').fill('09:35:00')
        self.save()
        p=self.record();parent=p['plan']['items'][0]['id']
        self.assertNotIn(parent,p['executions'])
        self.assertEqual(p['actual_details'][parent]['partial_end'],'09:35:00')
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="end"]').input_value(),'09:35:00')
        version=self.record()['version']
        self.page.locator('#actuals-form [name="finalize"]').click()
        self.page.wait_for_selector('.field-error')
        self.assertEqual(self.record()['version'],version)

    def test_24_hour_fields_preserve_exact_old_precision_and_status(self):
        self.open_record()
        self.page.evaluate("""()=>{const p=selected(),id=p.plan.items[0].id;
          p.executions[id].started='2026-10-10T12:30:00.123456Z';
          p.executions[id].ended='2026-10-10T09:35:00.654321-03:00';
          p.actual_details[id].status='nao_realizada';
          p.actual_details[id].subactivities=[{id:'old-child',parent_id:id,title:'Legado',responsible:'',note:'',start:'09:31:12.123456',end:'09:34:13.654321'}];
          p.extra_events[0].start='09:40:00.123456';p.extra_events[0].end='09:41:00.654321';
          localStorage.setItem(IASDPIStorage.programs,JSON.stringify([p]));render();} """)
        before=self.record()
        baseline=self.page.evaluate('JSON.stringify(executionInfo(selected()))')
        row=self.page.locator('.actual-row').first
        self.assertEqual(row.locator('[name="start"]').input_value(),'09:30:00')
        self.assertEqual(row.locator('[name="end"]').input_value(),'09:35:00')
        self.assertEqual(row.locator('[name="sub-start"]').input_value(),'09:31:12')
        values=self.page.locator('[data-real-time]').evaluate_all('(fields)=>fields.map(f=>({type:f.type,value:f.value,required:f.required}))')
        for value in values:
            self.assertEqual(value['type'],'text');self.assertFalse(value['required'])
            self.assertNotIn('.',value['value']);self.assertNotIn('M',value['value'])
        row.locator('[name="activity-note"]').fill('Nota alterada sem editar horários')
        self.save();after=self.record()
        self.assertEqual(after['executions'],before['executions'])
        self.assertEqual([{k:e[k] for k in old} for e,old in zip(after['extra_events'],before['extra_events'])],before['extra_events'])
        key=before['plan']['items'][0]['id']
        self.assertEqual(after['actual_details'][key]['status'],'nao_realizada')
        self.assertEqual(after['actual_details'][key]['subactivities'],before['actual_details'][key]['subactivities'])
        self.assertEqual(self.page.evaluate('JSON.stringify(executionInfo(selected()))'),baseline)
        self.assertTrue(self.page.evaluate('async()=>{const data=await backupPayload();return JSON.stringify(backupValidate(data))===JSON.stringify(data);}'))
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.record(),after)
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'09:30:00')

    def test_now_sao_paulo_for_parent_and_child_and_manual_24_hour_validation(self):
        self.open_record()
        self.page.evaluate("state.offset=new Date('2026-10-22T17:05:35.100Z').getTime()-Date.now()")
        row=self.page.locator('.actual-row').first
        row.locator('[data-action="time-now"][data-field="start"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(row.locator('[name="start"]').input_value(),'14:05:35')
        child=self.add_child()
        child.locator('[data-action="time-now"][data-field="sub-start"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(child.locator('[name="sub-start"]').input_value(),'14:05:35')
        row.locator('[name="start"]').fill('09:30:00')
        child.locator('[name="sub-start"]').fill('09:31:00')
        row.locator('[name="end"]').fill('25:00:00')
        version=self.record()['version']
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_selector('.field-error');self.assertEqual(self.record()['version'],version)
        row.locator('[name="end"]').fill('09:35:00')
        self.save()

    def test_blank_partial_fields_save_without_required_errors(self):
        self.open_record();row=self.page.locator('.actual-row').first
        row.locator('[name="start"]').fill('');row.locator('[name="end"]').fill('')
        self.assertEqual(self.page.locator('.field-error').count(),0)
        self.save();key=self.record()['plan']['items'][0]['id']
        self.assertNotIn(key,self.record()['executions'])
        self.assertEqual(self.page.locator('.field-error').count(),0)

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

    def new_from_model(self,model):
        self.page.clock.set_fixed_time('2026-10-22T01:30:00Z')
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && !state.busy')
        self.page.locator('nav [data-page="actuals"]').click()
        self.page.wait_for_selector('#new-record-form')
        self.assertEqual(self.page.locator('#new-culto-date-form').count(),0)
        self.page.locator('#new-record-form [name="template-id"]').select_option(model)
        self.page.locator('#new-record-form button').click()
        self.page.wait_for_selector('#actuals-form')
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.page.locator('[name="record-date"]').input_value(),'21/10/2026')

    def test_liturgy_template_preserves_original_plan_and_uses_sao_paulo_date(self):
        self.new_from_model('liturgy-i')
        from pathlib import Path
        template=json.loads((Path(__file__).resolve().parents[1]/'backend/chronogram.json').read_text())
        draft=self.page.evaluate('IASDPIChronogram')
        self.assertEqual(draft['date'],'2026-10-21')
        self.assertEqual(draft['template_id'],'liturgy-i')
        self.assertEqual(draft['items'],template['items'])
        self.assertEqual([draft['start'],draft['end']],[template['start'],template['end']])
        self.assertEqual(self.page.locator('.actual-row').count(),len(template['items']))
        self.page.locator('[name="record-date"]').fill('10/10/2026')
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_function('() => !state.busy && selected()?.version===2')
        saved=self.page.evaluate('selected()')
        self.assertEqual(saved['plan']['date'],'2026-10-10')
        self.assertTrue(all(i['planned_start'].startswith('2026-10-10') for i in saved['plan']['items']))
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("iasdpi-demo-v1"))[1]'),json.loads(self.raw)[0])
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('[name="record-date"]').input_value(),'10/10/2026')

    def test_free_starts_empty_saves_and_restores_without_template_request(self):
        requests=[];self.page.on('request',lambda r:requests.append(r.url))
        self.new_from_model('free')
        self.assertEqual(self.page.locator('.actual-row').count(),0)
        self.assertFalse(any('/iasdpi_templates?' in url for url in requests))
        self.assertEqual(self.page.evaluate('IASDPIChronogram.items'),[])
        self.assertEqual(self.page.evaluate('IASDPIChronogram.start'),'')
        self.page.locator('#actuals-form [name="save"]').click()
        self.page.wait_for_function('() => !state.busy && selected()?.version===2')
        identifier=self.page.evaluate('selected().id')
        outcome=self.page.evaluate('''async()=>{const data=await backupPayload();const copy=await decryptBackup(await encryptBackup(data,'backup-password-test'),'backup-password-test');return copy.programs[0];}''')
        self.assertEqual(outcome['plan']['items'],[])
        self.assertIsNone(outcome['planned_start']);self.assertIsNone(outcome['planned_end'])
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.evaluate('selected().id'),identifier)
        self.assertEqual(self.page.locator('.actual-row').count(),0)
        self.page.locator('#actuals-form [name="finalize"]').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertIn('Adicione atividades',self.page.locator('#notice').inner_text())
        self.assertEqual(self.page.evaluate('selected().status'),'Planejamento')

    def test_free_builds_planned_schedule_separately_and_preserves_execution_edit(self):
        self.new_from_model('free')
        self.page.locator('[data-action="edit-record-plan"]').click()
        self.page.wait_for_selector('#program-form')
        self.page.wait_for_function('() => !state.busy')
        identifier=self.page.evaluate('selected().id')
        self.assertEqual(self.page.locator('.item-editor').count(),0)
        self.page.locator('#program-form [name="start"]').fill('09:30')
        self.page.locator('#program-form [name="end"]').fill('09:40')
        self.page.locator('[data-action="add-item"]').click()
        self.page.wait_for_function('() => !state.busy')
        item=self.page.locator('.item-editor')
        item.locator('[name="activity"]').fill('Atividade livre')
        item.locator('[name="block"]').fill('Culto')
        item.locator('[name="start"]').fill('09:30')
        item.locator('[name="end"]').fill('09:40')
        self.page.locator('#program-form button[type="submit"]').click()
        self.page.wait_for_selector('#actuals-form')
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.page.evaluate('selected().id'),identifier)
        self.assertEqual(self.page.locator('.actual-row').count(),1)
        self.assertEqual(self.page.locator('#actuals-form [name="start"]').count(),1)
        self.assertEqual(self.page.locator('#actuals-form input[name="planned-start"]').count(),0)
        row=self.page.locator('.actual-row').first
        row.locator('[name="start"]').fill('09:31:00');row.locator('[name="end"]').fill('09:40:00')
        self.save()
        plan=self.page.evaluate('selected().plan')
        metrics=self.page.evaluate('JSON.stringify(executionInfo(selected()))')
        child=self.add_child(title='Detalhe livre',start='09:32:00',end='09:35:00')
        self.save()
        self.assertEqual(self.page.evaluate('selected().plan'),plan)
        self.assertEqual(self.page.evaluate('JSON.stringify(executionInfo(selected()))'),metrics)
        self.page.locator('[name="sub-title"]').fill('Detalhe revisado');self.save()
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-action="remove-subactivity"]').click()
        self.page.wait_for_function('() => !state.busy');self.save()
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('.subactivity').count(),0)
        self.assertEqual(self.page.evaluate('selected().id'),identifier)
        self.assertEqual(self.page.evaluate('state.programs.length'),2)
