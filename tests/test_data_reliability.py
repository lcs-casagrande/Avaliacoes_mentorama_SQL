"""Lote 2: dados fictícios, REST interceptado; nenhuma consulta à produção."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from urllib.parse import urlsplit

import test_frontend_access as base
import test_operational_browser as operational
import test_hour_format as hours


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class DataReliabilityTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    save=operational.OperationalBrowserTests.save
    enter=hours.HourFormatBrowserTests.enter

    def setUp(self):
        self.fail_list=False;self.hold_list=False;self.invalid_response=False;self.reads=0;self.held=[]
        hours.HourFormatBrowserTests.setUp(self)

    def supabase(self,route):
        path=urlsplit(route.request.url).path
        if path=='/rest/v1/iasdpi_programs':
            self.reads+=1
            if self.fail_list:return route.fulfill(status=503,json={'message':'Consulta temporariamente indisponível'})
            if self.hold_list:self.held.append(route);return
            if self.invalid_response:return route.fulfill(json={'error':'invalid'})
        return operational.OperationalBrowserTests.supabase(self,route)

    def metric(self,script):
        return self.page.evaluate('''(script)=>{const p=structuredClone(state.programs[0]);return new Function('p',script)(p);}''',script)

    def test_shared_validation_old_current_fraction_and_invalid_clocks(self):
        self.enter()
        result=self.page.evaluate("[null,'','09:30','09:30:00','09:30:12.123456','23:59:59','24:00','9:30','09:60:00','09:30 PM'].map(validRecordClock)")
        self.assertEqual(result,[False,False,True,True,True,True,False,False,False,False])
        self.assertTrue(self.page.evaluate('validActualTime===validRecordClock'))

    def test_encrypted_export_download_import_preserves_historical_payload_exactly(self):
        before=copy.deepcopy(self.records);self.enter()
        self.page.evaluate('navigate("archive")')
        self.page.locator('#backup-export-form [name="password"]').fill('senha-teste-segura')
        self.page.locator('#backup-export-form [name="repeat"]').fill('senha-teste-segura')
        with self.page.expect_download() as info:self.page.locator('#backup-export-form button').click()
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'backup.json';info.value.save_as(target)
            encrypted=json.loads(target.read_text())
            self.assertEqual(encrypted['format'],'IASDPI-encrypted-backup')
            decoded=self.page.evaluate("async value=>await decryptBackup(value,'senha-teste-segura')",encrypted)
            self.assertEqual(decoded['programs'],list(before.values()))
            self.page.locator('#backup-restore-form [name="file"]').set_input_files(str(target))
            self.page.locator('#backup-restore-form [name="password"]').fill('senha-teste-segura')
            self.page.locator('#backup-restore-form button').click()
            self.page.wait_for_function('()=>!state.busy')
            self.assertIn('Prévia de importação',self.page.locator('#app').inner_text())
            self.assertIn('Compatibilidade:',self.page.locator('#app').inner_text())
        self.assertEqual(self.records,before)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)

    def test_legacy_unencrypted_backup_restore_exact_and_idempotent(self):
        self.enter()
        result=self.page.evaluate('''async()=>{
          const original=await backupPayload(),raw=JSON.stringify(original);
          const restored=await decryptBackup(JSON.parse(raw),'');
          window.IASDPIOperational=null;window.IASDPIDemo={};localStorage.removeItem(archiveKey);
          const first=await restoreBackup(restored),second=await restoreBackup(restored);
          return {equal:localStorage.getItem(archiveKey)===JSON.stringify(original.programs),first,second,untouched:JSON.stringify(original)===raw};
        }''')
        self.assertEqual(result,{'equal':True,'first':{'added':1,'copies':0},'second':{'added':0,'copies':0},'untouched':True})

    def test_backup_accepts_clock_only_actuals_partial_and_old_status_without_mutation(self):
        self.enter()
        result=self.metric('''const i=p.plan.items[0].id;p.executions[i]={started:'09:30',ended:'09:35:15.654321'};p.actual_details[i].status='realizada';
          const j=p.plan.items[1].id;p.executions[j]={started:null,ended:null};p.actual_details[j]={partial_end:'09:40:00',status:'pendente'};
          const before=JSON.stringify(p);backupValidate({format:'IASDPI-backup',version:1,programs:[p]});return before===JSON.stringify(p);''')
        self.assertTrue(result)

    def test_backup_rejects_invalid_time_without_modifying_original(self):
        self.enter()
        self.assertEqual(self.metric('''p.plan.items[0].start='24:00';const before=JSON.stringify(p);let rejected=false;try{backupValidate({format:'IASDPI-backup',version:1,programs:[p]});}catch(_){rejected=true;}return {rejected,untouched:before===JSON.stringify(p)};'''),{'rejected':True,'untouched':True})

    def test_backup_wrong_password_tampering_and_short_password_remain_blocked(self):
        self.enter()
        self.assertEqual(self.page.evaluate('''async()=>{const p=await backupPayload(),encrypted=await encryptBackup(p,'senha-teste-segura');let denied=0;
          try{await encryptBackup(p,'curta');}catch(_){denied++;}
          try{await decryptBackup(encrypted,'incorreta');}catch(_){denied++;}
          encrypted.data=(encrypted.data[0]==='A'?'B':'A')+encrypted.data.slice(1);try{await decryptBackup(encrypted,'senha-teste-segura');}catch(_){denied++;}
          return denied;}'''),3)

    def test_operational_import_adaptation_is_explicit_and_retains_original(self):
        self.enter()
        result=self.metric('''const before=JSON.stringify(p);p.executions[p.plan.items[1].id]={started:'09:35:12.123456',ended:'09:40:15.654321'};const raw=structuredClone(p);const c=operationalImportCandidate(p);return {original:c.document.backup_source.document,raw,clock:c.document.plan.start,actual:c.document.executions[p.plan.items[1].id].started,changes:c.changes.length,unchanged:JSON.stringify(raw)===JSON.stringify(p)};''')
        self.assertEqual(result['original'],result['raw']);self.assertEqual(result['clock'],'09:30')
        self.assertEqual(result['actual'],'2026-10-10T09:35:12.123456-03:00');self.assertTrue(result['unchanged']);self.assertGreater(result['changes'],0)

    def test_nonzero_planned_seconds_are_backed_up_but_not_silently_truncated_on_import(self):
        self.enter()
        result=self.metric('''p.plan.items[0].start='09:30:12.123456';const backup={format:'IASDPI-backup',version:1,programs:[p]};backupValidate(backup);let message='';try{operationalImportCandidate(p);}catch(e){message=e.message;}return {value:p.plan.items[0].start,message};''')
        self.assertEqual(result['value'],'09:30:12.123456');self.assertIn('não nulos',result['message'])

    def test_historical_sao_paulo_import_retains_dst_and_fraction(self):
        self.enter()
        result=self.metric('''p.plan.date='2018-01-20';p.executions[p.plan.items[1].id]={started:'09:35:12.123456',ended:'09:40:15.654321'};return operationalImportCandidate(p).document.executions[p.plan.items[1].id];''')
        self.assertEqual(result['started'],'2018-01-20T09:35:12.123456-02:00')

    def test_loading_state_visible_until_query_is_confirmed(self):
        self.enter();self.hold_list=True
        self.page.evaluate('navigate("programs");void loadPrograms({renderState:true})')
        self.page.wait_for_selector('[data-load-state="loading"]')
        self.assertNotIn('Nenhuma programação',self.page.locator('#app').inner_text())
        self.hold_list=False
        for route in self.held:route.fulfill(json=[{'document':p} for p in self.records.values()])
        self.page.wait_for_function("()=>state.programsLoad.status==='records'")
        self.assertEqual(self.page.locator('[data-load-state]').count(),0)

    def test_initial_failure_never_appears_empty_and_retry_recovers(self):
        self.fail_list=True;self.open();self.login();self.page.wait_for_selector('[data-load-state="error"]')
        self.page.wait_for_function('()=>!state.busy&&!bootInProgress')
        self.assertNotIn('Vamos preparar',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.evaluate('state.programsLoad.status'),'error')
        self.fail_list=False;self.page.locator('[data-action="retry-programs"]').click()
        self.page.wait_for_function("()=>state.programsLoad.status==='records'&&!state.busy")
        self.page.evaluate('navigate("programs")');self.assertIn('Culto 24 horas',self.page.locator('#app').inner_text())

    def test_failed_reload_preserves_cached_records_and_drafts(self):
        self.enter();before=copy.deepcopy(self.records);self.fail_list=True
        self.page.evaluate('navigate("programs")')
        self.page.evaluate('async()=>{try{await loadPrograms({renderState:true});}catch(_){}}')
        self.assertEqual(self.page.evaluate('state.programs.length'),1)
        for view in ['history','programs','actuals','summary']:
            self.page.evaluate('(view)=>navigate(view)',view)
            self.assertEqual(self.page.locator('[data-load-state="error"]').count(),1)
            self.assertNotIn('Nenhuma programação',self.page.locator('#app').inner_text())
        self.assertEqual(self.records,before)
        self.page.evaluate('navigate("organization")');self.assertEqual(self.page.locator('[data-load-state]').count(),0)

    def test_retry_real_empty_is_only_shown_after_success(self):
        self.enter();self.fail_list=True
        self.page.evaluate('navigate("programs");')
        self.page.evaluate('async()=>{try{await loadPrograms({renderState:true});}catch(_){}}')
        self.records={};self.fail_list=False
        self.page.locator('[data-action="retry-programs"]').click()
        self.page.wait_for_function("()=>state.programsLoad.status==='empty'&&!state.busy")
        self.assertIn('Nenhuma programação cadastrada',self.page.locator('#app').inner_text())
        self.page.evaluate('navigate("history")');self.assertIn('Ainda não há programações finalizadas',self.page.locator('#app').inner_text())

    def test_malformed_query_response_is_error_not_empty(self):
        self.enter();self.invalid_response=True
        self.page.evaluate('navigate("programs")')
        self.page.evaluate('async()=>{try{await loadPrograms({renderState:true});}catch(_){}}')
        self.assertEqual(self.page.evaluate('state.programsLoad.status'),'error')
        self.assertEqual(self.page.evaluate('state.programs.length'),1)

    def test_missing_metrics_do_not_become_zero_or_positive(self):
        self.enter()
        result=self.metric('''p.executions={};p.actual_details={};return {m:executionInfo(p),a:adherence(p),text:summary(p)};''')
        self.assertIsNone(result['m']['shift']);self.assertIsNone(result['m']['actualDuration']);self.assertIsNone(result['a']['percent'])
        self.assertEqual(result['a']['missing'],16);self.assertIn('Dados incompletos',result['text']);self.assertNotIn('Nenhum atraso registrado',result['text'])

    def test_invalid_metrics_are_distinct_from_missing(self):
        self.enter()
        result=self.metric('''p.executions[p.plan.items[0].id].started='09:??';delete p.executions[p.plan.items[1].id];return {m:executionInfo(p),a:adherence(p)};''')
        self.assertIsNone(result['m']['shift']);self.assertEqual(result['a']['invalid'],1);self.assertEqual(result['a']['missing'],1);self.assertEqual(result['a']['total'],14)

    def test_incomplete_event_cannot_receive_positive_end_classification(self):
        self.enter()
        result=self.metric('''delete p.executions[p.plan.items[1].id];state.programs=[p];return {stats:endStatistics([p]),a:adherence(p),html:adherenceOverview()};''')
        self.assertEqual(result['stats'],{'considered':0,'excluded':1,'mean':None,'onTime':0})
        self.assertIn('badge neutral',result['html']);self.assertIn('parcial',result['html']);self.assertIn('1 desconsiderados',result['html'])

    def test_true_zero_deviation_remains_zero(self):
        self.enter()
        result=self.metric('''for(const i of p.plan.items)p.executions[i.id]={started:i.planned_start,ended:i.planned_end};return {shift:executionInfo(p).shift,a:adherence(p),stats:endStatistics([p])};''')
        self.assertEqual(result['shift'],0);self.assertEqual(result['a']['percent'],100)
        self.assertEqual(result['stats'],{'considered':1,'excluded':0,'mean':0,'onTime':1})

    def test_zero_duration_is_valid_without_division_by_zero(self):
        self.enter()
        result=self.metric('''for(const i of p.plan.items)p.executions[i.id]={started:i.planned_start,ended:i.planned_start};return {counts:executionInfo(p).counts,a:adherence(p),html:summary(p)};''')
        self.assertEqual(result['counts']['considered'],16);self.assertNotIn('NaN',result['html']);self.assertNotIn('Infinity',result['html'])
        self.assertIn('0 min',result['html'])

    def test_empty_and_invalid_history_have_no_nan_percent_or_division_by_zero(self):
        self.enter()
        result=self.metric('''p.executions={};p.actual_details={};p.executions[p.plan.items[0].id]={started:'inválido',ended:'inválido'};state.programs=[p];return {html:historyPage(),a:adherence(p)};''')
        self.assertIsNone(result['a']['percent']);self.assertNotIn('NaN',result['html']);self.assertNotIn('Infinity',result['html'])
        self.assertIn('Dados insuficientes',result['html']);self.assertIn('desconsiderad',result['html'])
        self.assertIsNone(self.page.evaluate('median([])'))

    def test_mixed_event_average_excludes_missing_instead_of_adding_zero(self):
        self.enter()
        result=self.metric('''const missing=structuredClone(p);missing.executions={};missing.actual_details={};return {single:endStatistics([p]),mixed:endStatistics([p,missing])};''')
        self.assertEqual(result['single']['mean'],result['mixed']['mean']);self.assertEqual(result['mixed']['considered'],1);self.assertEqual(result['mixed']['excluded'],1)

    def test_negative_and_wrong_day_intervals_are_invalid(self):
        self.enter()
        result=self.metric('''p.executions[p.plan.items[0].id]={started:'09:40',ended:'09:30'};p.executions[p.plan.items[1].id]={started:'2026-10-11T09:35:00-03:00',ended:'2026-10-11T09:40:00-03:00'};return {a:adherence(p),m:executionInfo(p)};''')
        self.assertEqual(result['a']['invalid'],2);self.assertIsNone(result['m']['actualDuration']);self.assertIsNone(result['m']['shift'])

    def test_missing_planned_end_has_no_fake_duration_deviation(self):
        self.enter()
        result=self.metric("p.planned_end='inválido';return summary(p);")
        self.assertNotIn('NaN',result);self.assertIn('<span>Desvio da duração</span><strong>—</strong>',result)

    def test_medians_report_counts_and_ignore_invalid_intervals(self):
        self.enter()
        result=self.metric('''const missing=structuredClone(p);missing.executions={};missing.actual_details={};const bad=structuredClone(p);bad.executions[p.plan.items[0].id]={started:'inválido',ended:'inválido'};return activityMedians([p,missing,bad]);''')
        music=next(g for g in result if g['name']=='Música Congregacional')
        self.assertGreater(music['missing'],0);self.assertEqual(music['invalid'],1);self.assertTrue(music['values'])

    def test_subactivities_never_change_duration_shift_or_adherence(self):
        self.enter()
        self.assertTrue(self.metric('''const before=JSON.stringify([executionInfo(p),adherence(p)]);p.actual_details[p.plan.items[0].id].subactivities=[];return before===JSON.stringify([executionInfo(p),adherence(p)]);'''))

    def test_create_edit_finalize_and_reopen_keep_ids_plans_and_precision(self):
        self.enter();before=copy.deepcopy(self.records['clock-fixture']);self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Salvo e finalizado no teste')
        self.page.locator('#actuals-form [name="finalize"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['status'],'Finalizada');self.assertEqual(len(self.records),1)
        self.assertEqual(self.records['clock-fixture']['executions'],before['executions'])
        self.page.reload();self.page.wait_for_function('()=>!bootInProgress&&IASDPIAuth.allowed()')
        self.assertEqual(self.page.evaluate('state.programs.length'),1)
        self.page.evaluate('navigate("actuals","clock-fixture")')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Salvo e finalizado no teste')

    def test_paginated_failure_keeps_prior_list_instead_of_partial_results(self):
        self.enter();original=copy.deepcopy(self.records['clock-fixture']);calls=[]
        def pages(route):
            calls.append(route.request.url)
            if 'offset=0' in route.request.url:
                return route.fulfill(json=[{'document':dict(original,id='partial-'+str(i))} for i in range(500)])
            return route.fulfill(status=503,json={'message':'Segunda página indisponível'})
        self.page.route('https://*.supabase.co/rest/v1/iasdpi_programs?*',pages)
        self.page.evaluate('navigate("programs")')
        self.page.evaluate('async()=>{try{await loadPrograms({renderState:true});}catch(_){}}')
        self.assertEqual(len(calls),2);self.assertEqual(self.page.evaluate('state.programs'),[original])
        self.assertEqual(self.page.evaluate('state.programsLoad.status'),'error')

    def test_session_change_during_loading_cannot_repopulate_private_data(self):
        self.enter();self.hold_list=True
        self.page.evaluate('navigate("programs");void loadPrograms({renderState:true}).catch(()=>{})')
        self.page.wait_for_selector('[data-load-state="loading"]')
        self.page.evaluate('async()=>await IASDPIAuth.logout()')
        for route in self.held:route.fulfill(json=[{'document':p} for p in self.records.values()])
        self.page.wait_for_function('()=>!IASDPIAuth.allowed()&&state.programs.length===0')
        self.assertEqual(self.page.evaluate('state.programsLoad.status'),'idle')

    def test_users_query_failure_has_retry_and_not_empty_message(self):
        self.enter();self.page.route('https://*.supabase.co/rest/v1/rpc/iasdpi_list_*',lambda route:route.fulfill(status=503,json={'message':'Indisponível'}))
        self.page.evaluate('navigate("users");void refreshUsers().catch(()=>{})')
        self.page.wait_for_selector('.form-error')
        self.assertIn('Erro ao carregar usuários',self.page.locator('#app').inner_text())
        self.assertNotIn('Nenhum usuário',self.page.locator('#app').inner_text())
        self.assertNotIn('Nenhum convite',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('[data-action="users-refresh"]').count(),2)

    def test_archives_query_failure_has_retry_and_not_empty_message(self):
        self.enter();self.page.route('https://*.supabase.co/rest/v1/culto_archives?*',lambda route:route.fulfill(status=503,json={'message':'Indisponível'}))
        self.page.evaluate('navigate("archive");void refreshArchives().catch(()=>{})')
        self.page.wait_for_selector('.form-error')
        self.assertIn('Erro ao carregar arquivos',self.page.locator('#app').inner_text())
        self.assertNotIn('Nenhum arquivo histórico',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('[data-action="cloud-list"]').count(),2)

    def test_trash_query_failure_has_retry_and_not_empty_message(self):
        self.enter();self.page.route('https://*.supabase.co/rest/v1/rpc/iasdpi_list_trash',lambda route:route.fulfill(status=503,json={'message':'Indisponível'}))
        self.page.evaluate('navigate("trash");void refreshTrash()')
        self.page.wait_for_selector('.form-error')
        self.assertNotIn('Lixeira vazia',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('[data-action="trash-refresh"]').count(),2)


    def test_invalid_program_boundary_preserves_measured_duration_but_no_punctuality(self):
        self.enter()
        result=self.metric("p.planned_end='inválido';return {m:executionInfo(p),a:adherence(p)};")
        self.assertFalse(result['m']['complete']);self.assertIsNone(result['m']['shift'])
        self.assertIsNotNone(result['m']['actualDuration'])

    def test_incomplete_extra_is_counted_and_prevents_whole_event_classification(self):
        self.enter()
        result=self.metric("p.extra_events=[{id:'legacy-extra',position:1,activity:'Extra',start:'09:35:00',end:''}];return {m:executionInfo(p),html:summary(p)};")
        self.assertIsNone(result['m']['shift']);self.assertIsNone(result['m']['actualDuration'])
        self.assertEqual(result['m']['extraCounts']['missing'],1);self.assertIn('Atividades extras:',result['html'])

    def test_missing_planned_timestamps_use_existing_clock_fallback_without_mutation(self):
        self.enter()
        result=self.metric("for(const i of p.plan.items){i.planned_start='';i.planned_end=null;}const before=JSON.stringify(p);return {a:adherence(p),unchanged:before===JSON.stringify(p)};")
        self.assertEqual(result['a']['considered'],16);self.assertTrue(result['unchanged'])

    def test_transitions_exclude_invalid_wrong_day_and_inverted_intervals(self):
        self.enter()
        result=self.metric("p.executions[p.plan.items[0].id]={started:'2026-10-11T09:30:00-03:00',ended:'2026-10-11T09:35:00-03:00'};return {t:transitions(p),html:transitionView([p])};")
        self.assertIsNone(result['t'][0]['seconds']);self.assertIn('desconsideradas por horários ausentes ou inválidos',result['html'])
        self.assertFalse(any('NaN' in str(t) for t in result['t']))

    def test_malformed_program_array_preserves_previous_confirmed_list(self):
        self.enter();before=self.page.evaluate('state.programs')
        self.page.route('https://*.supabase.co/rest/v1/iasdpi_programs?*',lambda route:route.fulfill(json=[{'document':None}]))
        self.page.evaluate('navigate("programs")')
        self.page.evaluate('async()=>{try{await loadPrograms({renderState:true});}catch(_){}}')
        self.assertEqual(self.page.evaluate('state.programs'),before)
        self.assertEqual(self.page.evaluate('state.programsLoad.status'),'error')

    def test_unrepresentable_historical_time_is_blocked_in_import_preview(self):
        self.enter();before=copy.deepcopy(self.records)
        self.page.evaluate("async()=>{const p=structuredClone(state.programs[0]);p.plan.items[0].start='09:30:12';state.page='archive';await IASDPIOperational.importDocuments([p]);}")
        self.assertIn('segundos não nulos',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('[data-import-id]').count(),0)
        self.assertEqual(self.records,before)


import subprocess
import test_operational_sql as sqlbase
import test_user_management_sql as access


@unittest.skipUnless(access.CONTAINER,'Defina IASDPI_PG_TEST_CONTAINER para PostgreSQL sem rede')
class HistoricalRestoreSQLTests(unittest.TestCase):
    setUpClass=classmethod(access.UserManagementSQLTests.setUpClass.__func__)
    command=access.UserManagementSQLTests.command
    sql=access.UserManagementSQLTests.sql
    quote=staticmethod(sqlbase.OperationalSQLTests.quote)
    call=sqlbase.OperationalSQLTests.call

    def setUp(self):
        sqlbase.OperationalSQLTests.setUp(self)
        self.sql((access.ROOT/'database/004_culto_trash.sql').read_text())

    def candidate(self,p):
        code="const IASDPIStorage={programs:'test'};"+(access.ROOT/'frontend/record-time.js').read_text()+(access.ROOT/'frontend/archive.js').read_text()+"\nconsole.log(JSON.stringify(operationalImportCandidate(JSON.parse(require('fs').readFileSync(0,'utf8'))).document));"
        return json.loads(subprocess.check_output(['node','-e',code],input=json.dumps(p),text=True))

    def legacy(self):
        for obj in [self.p['plan'],*self.p['plan']['items']]:
            for key in ['start','end']:obj[key]+=':00'
        for item in self.p['plan']['items']:
            self.p['executions'][item['id']]={'started':item['start'],'ended':item['end']}
        self.p['executions'][self.parent]['started']='09:30:12.123456'
        self.p['executions'][self.parent]['ended']='09:35:15.654321'
        self.p['actual_details'][self.parent]['subactivities']=[dict(self.child,start='09:31:20.123456',end='09:32:20.654321')]
        return copy.deepcopy(self.p)

    def test_real_import_reopen_source_precision_and_idempotency(self):
        original=self.legacy();candidate=self.candidate(original)
        saved=self.call(candidate,importing=True)['document']
        self.assertEqual(saved['backup_source']['document'],original)
        self.assertEqual(saved['executions'][self.parent]['started'],'2026-10-10T09:30:12.123456-03:00')
        stored=json.loads(self.sql('select document from public.iasdpi_programs',actor=access.L))
        self.assertEqual(stored,saved)
        self.assertEqual(self.sql("select to_char(actual_start at time zone 'America/Sao_Paulo','HH24:MI:SS.US') from public.iasdpi_activities where id="+self.quote(self.parent)),'09:30:12.123456')
        self.assertEqual(self.call(candidate,importing=True)['status'],'exists')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'1')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities'),'16')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_subactivities'),'1')

    def test_real_import_historical_dst_and_precision_preserved(self):
        original=self.legacy();original['plan']['date']='2018-01-20'
        for obj in [original,*original['plan']['items']]:
            for key in ['planned_start','planned_end']:
                obj[key]=obj[key].replace('2026-10-10','2018-01-20').replace('-03:00','-02:00')
        candidate=self.candidate(original);saved=self.call(candidate,importing=True)['document']
        self.assertEqual(saved['executions'][self.parent]['started'],'2018-01-20T09:30:12.123456-02:00')
        self.assertEqual(self.sql("select to_char(actual_start at time zone 'UTC','HH24:MI:SS.US') from public.iasdpi_activities where id="+self.quote(self.parent)),'11:30:12.123456')
        self.assertEqual(saved['backup_source']['document'],original)

    def test_sql_edit_after_import_keeps_original_backup_and_unedited_times(self):
        original=self.legacy();saved=self.call(self.candidate(original),importing=True)['document']
        saved['note']='Edição posterior à restauração';updated=self.call(saved,version=1)['document']
        self.assertEqual(updated['backup_source']['document'],original)
        self.assertEqual(updated['executions'],saved['executions'])
        self.assertEqual(updated['actual_details'],saved['actual_details'])
        self.assertEqual(updated['id'],original['id']);self.assertEqual(updated['version'],2)
