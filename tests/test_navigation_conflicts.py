"""Lote 4: fluxos interativos isolados, duas contas fictícias e REST interceptado."""
import copy
import json
import re
import shutil
import unittest
from urllib.parse import urlsplit,parse_qs

import test_frontend_access as base
import test_hour_format as hours
import test_operational_browser as operational

USER_B='22222222-2222-4222-8222-222222222222'

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class NavigationConflictTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    enter=hours.HourFormatBrowserTests.enter
    save=operational.OperationalBrowserTests.save

    def setUp(self):
        self.roles={base.USER:'admin',USER_B:'leader'};self.saves=[]
        hours.HourFormatBrowserTests.setUp(self)
        self.original=copy.deepcopy(self.records['clock-fixture'])

    def supabase(self,route):
        request=route.request;url=urlsplit(request.url);path=url.path
        if path=='/auth/v1/token':
            body=request.post_data_json
            uid=USER_B if body.get('email')=='b@example.invalid' else base.USER
            return route.fulfill(json={'access_token':'valid.b.token' if uid==USER_B else 'valid.a.token','refresh_token':'fake-refresh','token_type':'bearer','expires_in':3600,'user':{'id':uid,'email':'b@example.invalid' if uid==USER_B else 'test@example.invalid'}})
        if path=='/auth/v1/user':
            uid=USER_B if 'valid.b.token' in request.headers.get('authorization','') else base.USER
            return route.fulfill(json={'id':uid,'email':'b@example.invalid' if uid==USER_B else 'test@example.invalid','is_anonymous':False})
        if path=='/rest/v1/iasdpi_access':
            uid=parse_qs(url.query).get('user_id',[''])[0].removeprefix('eq.');role=self.roles.get(uid)
            return route.fulfill(json=[{'user_id':uid,'role':role,'enabled':True}] if role else [])
        if path.endswith('/iasdpi_save_program'):self.saves.append(copy.deepcopy(request.post_data_json))
        return operational.OperationalBrowserTests.supabase(self,route)

    def edit(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")')

    def conflict(self,notes=True):
        self.edit();self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('MINHA EDIÇÃO LOCAL')
        self.records['clock-fixture']['version']=2
        if notes:self.records['clock-fixture']['note']='NOTA RECENTE DO BANCO'
        self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')

    def select_and_apply(self,selector='[data-conflict-choice]:enabled'):
        self.page.locator('[data-conflict-dialog] '+selector).first.check()
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-conflict-apply]').click()
        self.page.wait_for_function('()=>!state.busy&&!document.querySelector("[data-conflict-dialog]").open')

    def test_back_forward_and_no_duplicate_entries(self):
        self.enter();start=self.page.evaluate('history.length')
        self.page.evaluate('navigate("programs")');self.page.evaluate('navigate("history")')
        self.assertEqual(self.page.evaluate('history.length'),start+2)
        self.page.evaluate('navigate("history")');self.assertEqual(self.page.evaluate('history.length'),start+2)
        self.page.go_back();self.page.wait_for_function('()=>state.page==="programs"')
        self.page.go_back();self.page.wait_for_function('()=>state.page==="home"')
        self.page.go_forward();self.page.wait_for_function('()=>state.page==="programs"')
        self.page.go_forward();self.page.wait_for_function('()=>state.page==="history"')

    def test_direct_link_reload_and_missing_record(self):
        self.enter();self.page.goto(self.base+'#actuals/clock-fixture');self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-id'),'clock-fixture')
        length=self.page.evaluate('history.length');self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.evaluate('history.length'),length)
        self.page.goto(self.base+'#actuals/unknown-id');self.page.wait_for_function('()=>!bootInProgress&&IASDPIAuth.allowed()')
        self.assertIn('Registro não encontrado',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('#actuals-form,#program-form').count(),0)

    def test_conflict_compare_selective_reapply_and_save_same_id(self):
        self.conflict();remote=copy.deepcopy(self.records['clock-fixture'])
        self.assertIn('Banco: versão 2',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertIn('MINHA EDIÇÃO LOCAL',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertEqual(self.page.locator('[data-conflict-choice]:checked').count(),0)
        self.assertEqual(self.page.locator('[data-conflict-choice]:enabled').count(),1)
        self.select_and_apply();self.assertEqual(self.records['clock-fixture'],remote)
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-version'),'2')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'MINHA EDIÇÃO LOCAL')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'NOTA RECENTE DO BANCO')
        self.save();saved=self.records['clock-fixture']
        self.assertEqual(saved['version'],3);self.assertEqual(saved['id'],remote['id']);self.assertEqual(len(self.records),1)
        self.assertEqual(saved['note'],'NOTA RECENTE DO BANCO');self.assertEqual(saved['actual_details'][self.parent]['note'],'MINHA EDIÇÃO LOCAL')
        self.assertEqual(saved['executions'],remote['executions'])

    def test_old_draft_comparison_requires_explicit_selection(self):
        self.edit();self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('RASCUNHO ANTIGO')
        self.page.evaluate('async()=>await IASDPIDrafts.flush()')
        self.records['clock-fixture']['version']=2;self.records['clock-fixture']['note']='NOVA NOTA'
        self.page.once('dialog',lambda d:d.accept());self.page.reload();self.page.wait_for_selector('[data-draft-compare]')
        self.assertTrue(self.page.locator('[data-draft-restore]').is_disabled())
        self.page.locator('[data-draft-compare]').click();self.page.wait_for_selector('[data-conflict-dialog][open]');self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Rascunho antigo',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertEqual(self.page.locator('[data-conflict-choice]:checked').count(),0)
        checkbox=self.page.get_by_role('checkbox',name=re.compile('Reaplicar .*Observação da atividade'))
        checkbox.first.check();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-conflict-apply]').click()
        self.page.wait_for_function('()=>!state.busy&&!document.querySelector("[data-conflict-dialog]").open')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'RASCUNHO ANTIGO')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'NOVA NOTA')
        self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_subactivity_names_are_unique_and_identify_parent(self):
        self.edit();self.page.locator('.actual-row').first.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('()=>!state.busy')
        self.page.locator('.subactivity [name="sub-title"]').nth(1).fill('Segundo detalhe')
        names=self.page.locator('.subactivity input,.subactivity textarea').evaluate_all('(els)=>els.map(e=>e.getAttribute("aria-label"))')
        self.assertEqual(len(names),len(set(names)));self.assertTrue(all('Atividade 1:' in name and 'Subatividade ' in name for name in names))
        self.assertIn('Subatividade 2: Segundo detalhe',names[-1])

    def test_back_cancel_preserves_form_and_forward_after_accepted_exit(self):
        self.edit();self.page.locator('[name="note"]').fill('NÃO DESCARTAR')
        self.page.once('dialog',lambda d:d.dismiss());self.page.go_back()
        self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'NÃO DESCARTAR')
        self.page.once('dialog',lambda d:d.accept());self.page.go_back();self.page.wait_for_function('()=>state.page==="home"')
        self.page.go_forward();self.page.wait_for_selector('[data-draft-restore]')
        self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'NÃO DESCARTAR')
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_menu_cancel_and_skip_link_do_not_add_entries(self):
        self.edit();self.page.locator('[name="note"]').fill('Pendente');length=self.page.evaluate('history.length')
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('nav [data-page="history"]').click()
        self.assertEqual(self.page.evaluate('state.page'),'actuals');self.assertEqual(self.page.evaluate('history.length'),length)
        self.page.locator('.skip-link').evaluate('(a)=>a.click()')
        self.assertEqual(self.page.evaluate('location.hash'),'#actuals/clock-fixture')
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'app')

    def test_hash_change_cancel_restores_url_without_loops(self):
        self.edit();self.page.locator('[name="note"]').fill('Pendente')
        dialogs=[]
        self.page.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
        self.page.evaluate('location.hash="history"');self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"')
        self.page.wait_for_timeout(100)
        self.assertEqual(len(dialogs),1);self.assertEqual(self.page.evaluate('state.page'),'actuals')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'Pendente')

    def test_save_existing_keeps_history_and_reload_data(self):
        self.edit();length=self.page.evaluate('history.length')
        self.page.locator('[name="note"]').fill('REABRIR');self.save()
        self.assertEqual(self.page.evaluate('history.length'),length)
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'REABRIR')
        self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_blank_editor_reload_does_not_select_previous_record(self):
        self.enter();self.page.evaluate('navigate("edit")');self.page.wait_for_selector('#program-form')
        self.assertFalse(self.page.locator('#program-form').get_attribute('data-id'))
        self.page.reload();self.page.wait_for_selector('#program-form')
        self.assertFalse(self.page.locator('#program-form').get_attribute('data-id'))
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_cancel_conflict_confirmation_preserves_old_fields(self):
        self.conflict();self.page.locator('[data-conflict-choice]:enabled').first.check()
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-conflict-apply]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertTrue(self.page.locator('[data-conflict-dialog]').is_visible())
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-version'),'1')
        self.page.locator('[data-conflict-close]').click()
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'MINHA EDIÇÃO LOCAL')
        self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_concurrent_third_version_forces_new_comparison_and_selection(self):
        self.conflict();self.records['clock-fixture']['version']=3;self.records['clock-fixture']['note']='TERCEIRA VERSÃO'
        self.page.locator('[data-conflict-choice]:enabled').first.check();self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-conflict-apply]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Banco: versão 3',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertIn('mudou novamente',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertEqual(self.page.locator('[data-conflict-choice]:checked').count(),0)
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-version'),'1')
        self.select_and_apply();self.save()
        self.assertEqual(self.records['clock-fixture']['version'],4);self.assertEqual(self.records['clock-fixture']['note'],'TERCEIRA VERSÃO')

    def test_conflict_after_rebase_still_rejects_stale_save(self):
        self.conflict();self.select_and_apply();self.records['clock-fixture']['version']=3;self.records['clock-fixture']['note']='EDIÇÃO POSTERIOR'
        self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.assertEqual(self.records['clock-fixture']['version'],3)
        self.assertEqual(self.records['clock-fixture']['note'],'EDIÇÃO POSTERIOR')
        self.assertIn('Banco: versão 3',self.page.locator('[data-conflict-dialog]').inner_text())

    def test_load_bank_keeps_local_encrypted_copy_without_writing(self):
        self.conflict();remote=copy.deepcopy(self.records['clock-fixture']);count=len(self.saves)
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-conflict-load]').click()
        self.page.wait_for_function('()=>!state.busy&&!document.querySelector("[data-conflict-dialog]").open')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Nota')
        self.assertEqual(self.records['clock-fixture'],remote);self.assertEqual(len(self.saves),count)
        copies=self.page.evaluate('''async()=>{await IASDPIDrafts.flush();return await new Promise(resolve=>{const r=indexedDB.open('iasdpi-edit-drafts-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('drafts').objectStore('drafts').getAll();q.onsuccess=()=>{resolve(q.result.map(row=>({key:row.key,version:row.baseVersion,cipher:row.cipher instanceof ArrayBuffer,plain:JSON.stringify(row)})));db.close();};};});}''')
        forks=[r for r in copies if ':conflict:' in r['key']]
        self.assertEqual(len(forks),1);self.assertEqual(forks[0]['version'],1);self.assertTrue(forks[0]['cipher'])
        self.assertNotIn('MINHA EDIÇÃO LOCAL',forks[0]['plain'])

    def test_failed_comparison_refresh_shows_modal_error_and_retries(self):
        self.conflict()
        def fail(route):return route.abort('failed')
        self.page.route('**/rest/v1/iasdpi_programs?*id=eq.clock-fixture*',fail)
        self.page.locator('[data-conflict-refresh]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('consulta',self.page.locator('.conflict-feedback').inner_text())
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-version'),'1')
        self.page.unroute('**/rest/v1/iasdpi_programs?*id=eq.clock-fixture*',fail)
        self.page.locator('[data-conflict-refresh]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Comparação atualizada',self.page.locator('[data-conflict-dialog]').inner_text())

    def test_revoked_access_during_comparison_prevents_reapply(self):
        self.conflict();self.roles[base.USER]=None
        self.page.locator('[data-conflict-choice]:enabled').first.check();self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-conflict-apply]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.records['clock-fixture']['version'],2)
        self.assertFalse(self.page.locator('[data-conflict-dialog]').is_visible())

    def test_new_subactivity_merge_preserves_remote_subactivity(self):
        self.edit();row=self.page.locator('.actual-row').first
        row.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('()=>!state.busy')
        row.locator('[name="sub-title"]').nth(1).fill('DETALHE LOCAL')
        record=self.records['clock-fixture'];record['version']=2
        record['actual_details'][self.parent]['subactivities'].append({'id':'remote-child','parent_id':self.parent,'title':'DETALHE REMOTO','responsible':'','note':'','start':'','end':''})
        self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.select_and_apply('[data-conflict-choice]:enabled');self.save()
        titles=[c['title'] for c in self.records['clock-fixture']['actual_details'][self.parent]['subactivities']]
        self.assertEqual(titles,['Detalhe','DETALHE REMOTO','DETALHE LOCAL'])
        self.assertEqual(self.records['clock-fixture']['executions'],self.original['executions'])

    def test_subactivity_deletion_requires_choice_and_keeps_bank_notes(self):
        self.edit();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-action="remove-subactivity"]').first.click()
        self.page.wait_for_function('()=>!state.busy');self.records['clock-fixture']['version']=2;self.records['clock-fixture']['note']='NOTA REMOTA'
        self.save();self.page.wait_for_selector('[data-conflict-dialog][open]');self.select_and_apply();self.save()
        self.assertEqual(self.records['clock-fixture']['actual_details'][self.parent]['subactivities'],[])
        self.assertEqual(self.records['clock-fixture']['note'],'NOTA REMOTA')

    def test_two_users_conflict_does_not_overwrite_leader_changes(self):
        self.edit();self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('ADMIN LOCAL')
        second=self.browser.new_context();second.route('https://*.supabase.co/**',self.supabase)
        try:
            page=second.new_page();page.goto(self.base+'#login')
            page.locator('[name="email"]').fill('b@example.invalid');page.locator('[name="password"]').fill('correct-password');page.locator('#auth-login-form button').click()
            page.wait_for_function('()=>IASDPIAuth.allowed()&&!state.busy&&!bootInProgress')
            page.evaluate('navigate("actuals","clock-fixture")');page.locator('[name="note"]').fill('LÍDER NO BANCO')
            page.locator('.actual-row').first.locator('[name="activity-note"]').fill('LÍDER ATIVIDADE')
            page.locator('[name="save"]').click();page.wait_for_function('()=>!state.busy')
            self.assertEqual(self.records['clock-fixture']['version'],2)
            self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')
            self.assertIn('LÍDER ATIVIDADE',self.page.locator('[data-conflict-dialog]').inner_text())
            self.select_and_apply();self.save()
            self.assertEqual(self.records['clock-fixture']['note'],'LÍDER NO BANCO')
            self.assertEqual(self.records['clock-fixture']['actual_details'][self.parent]['note'],'ADMIN LOCAL')
            self.assertEqual(self.records['clock-fixture']['version'],3)
        finally:second.close()

    def test_planning_conflict_preserves_recent_metadata_and_unselected_fields(self):
        record=self.records['clock-fixture'];record.update(status='Planejamento',executions={},actual_details={})
        record['plan']['private_annotation']='Metadado original';record['plan']['items'][0]['custom_data']={'preserve':True}
        self.enter();self.page.evaluate('navigate("plan-edit","clock-fixture")')
        self.page.locator('#program-form .form-grid [name="name"]').fill('NOME LOCAL')
        record['version']=2;record['plan']['private_annotation']='Metadado recente';record['plan']['items'][0]['note']='NOTA PREVISTA REMOTA'
        self.page.locator('#program-form [type="submit"]').click();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.select_and_apply();self.assertEqual(record['version'],2)
        self.page.locator('#program-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        saved=self.records['clock-fixture'];self.assertEqual(saved['version'],3)
        self.assertEqual(saved['plan']['name'],'NOME LOCAL');self.assertEqual(saved['plan']['items'][0]['note'],'NOTA PREVISTA REMOTA')
        self.assertEqual(saved['plan']['private_annotation'],'Metadado recente');self.assertEqual(saved['plan']['items'][0]['custom_data'],{'preserve':True})

    def test_planning_protected_after_start_cannot_reapply(self):
        record=self.records['clock-fixture'];record.update(status='Planejamento',executions={},actual_details={})
        self.enter();self.page.evaluate('navigate("plan-edit","clock-fixture")')
        self.page.locator('#program-form .form-grid [name="name"]').fill('NÃO APLICAR')
        record['version']=2;record['status']='Em andamento'
        self.page.locator('#program-form [type="submit"]').click();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.assertEqual(self.page.locator('[data-conflict-choice]:enabled').count(),0)
        self.assertTrue(self.page.locator('[data-conflict-apply]').is_disabled());self.assertEqual(record['plan']['name'],'Culto 24 horas')

    def test_notes_conflict_reapply_same_id_preserves_remote_incident(self):
        self.enter();self.page.evaluate('navigate("summary","clock-fixture")')
        self.page.locator('#notes-form [name="note"]').fill('MINHA NOTA')
        self.records['clock-fixture']['version']=2;self.records['clock-fixture']['incident']='OCORRÊNCIA REMOTA'
        self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.select_and_apply();self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['note'],'MINHA NOTA');self.assertEqual(self.records['clock-fixture']['incident'],'OCORRÊNCIA REMOTA')
        self.assertEqual(self.records['clock-fixture']['version'],3)

    def test_conflict_dialog_keyboard_focus_escape_and_no_focus_loss(self):
        self.conflict()
        self.assertEqual(self.page.evaluate('document.activeElement.hasAttribute("data-conflict-close")'),True)
        for _ in range(14):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate('document.activeElement===document.body||!!document.activeElement.closest("[data-conflict-dialog]")'))
        self.page.keyboard.press('Escape');self.page.wait_for_function('()=>!document.querySelector("[data-conflict-dialog]").open')
        self.page.wait_for_function('()=>document.activeElement.name==="save"')
        self.page.keyboard.press('Tab');self.assertTrue(self.page.evaluate('document.activeElement!==document.body'))

    def test_conflict_modal_fits_five_widths_and_table_scrolls_locally(self):
        self.conflict()
        for width in (360,390,768,1024,1440):
            self.page.set_viewport_size({'width':width,'height':900})
            sizes=self.page.evaluate('''()=>({page:document.documentElement.scrollWidth,width:innerWidth,dialog:document.querySelector('[data-conflict-dialog]').getBoundingClientRect().width,table:document.querySelector('[data-conflict-dialog] .table-scroll').scrollWidth,region:document.querySelector('[data-conflict-dialog] .table-scroll').clientWidth})''')
            self.assertLessEqual(sizes['page'],width);self.assertLessEqual(sizes['dialog'],width)
            self.assertGreater(sizes['table'],sizes['region']) if width<768 else None
        self.page.set_viewport_size({'width':360,'height':900})
        region=self.page.locator('[data-conflict-dialog] .table-scroll');region.focus();self.page.keyboard.press('ArrowRight')
        self.page.wait_for_function('()=>document.querySelector("[data-conflict-dialog] .table-scroll").scrollLeft>0')

    def test_comparison_escapes_html_and_long_text_without_page_overflow(self):
        self.edit();note='<img src=x onerror="window.injected=true">'+('LONGO'*200)
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill(note)
        self.records['clock-fixture']['version']=2;self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.page.set_viewport_size({'width':360,'height':800})
        self.assertEqual(self.page.locator('[data-conflict-dialog] img').count(),0);self.assertFalse(self.page.evaluate('!!window.injected'))
        self.assertIn('<img src=x',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),360)

    def test_program_selects_have_consistent_font_height_and_keyboard_access(self):
        self.enter();self.page.evaluate('navigate("actuals")')
        for name in ('template-id','record-id'):
            control=self.page.locator('select[name="'+name+'"]');control.focus()
            style=control.evaluate('(e)=>({height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,padding:getComputedStyle(e).padding})')
            self.assertGreaterEqual(style['height'],48);self.assertEqual(style['font'],'16px');self.assertEqual(style['padding'],'11px 12px')
            self.assertTrue(control.evaluate('(e)=>document.activeElement===e'))
        self.page.evaluate('navigate("archive")');control=self.page.locator('select[name="program-id"]');control.focus()
        self.assertGreaterEqual(control.evaluate('(e)=>e.getBoundingClientRect().height'),48)
        self.assertEqual(control.evaluate('(e)=>getComputedStyle(e).fontSize'),'16px')

    def test_focus_visible_and_keyboard_menu_navigation(self):
        self.enter();link=self.page.locator('nav [data-page="programs"]');link.focus();self.page.keyboard.press('Tab');self.page.keyboard.press('Shift+Tab')
        outline=link.evaluate('(e)=>({width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor})')
        self.assertEqual(outline['width'],'3px');self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('state.page'),'programs');self.assertEqual(self.page.evaluate('document.activeElement.id'),'app')

    def test_child_names_update_after_deletion_and_draft_recovery(self):
        self.edit();row=self.page.locator('.actual-row').first
        row.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('()=>!state.busy')
        row.locator('[name="sub-title"]').nth(1).fill('Segundo')
        self.page.once('dialog',lambda d:d.accept());row.locator('[data-action="remove-subactivity"]').first.click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Subatividade 1: Segundo',row.locator('[name="sub-title"]').get_attribute('aria-label'))
        self.page.evaluate('async()=>await IASDPIDrafts.flush()');self.page.once('dialog',lambda d:d.accept());self.page.reload()
        self.page.wait_for_selector('[data-draft-restore]');self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Subatividade 1: Segundo',self.page.locator('.actual-row').first.locator('[name="sub-title"]').get_attribute('aria-label'))

    def test_live_action_refreshes_same_route_without_duplicate_history(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        record=self.records['clock-fixture'];record.update(execution_mode='live',status='Pronta',executions={},actual_details={})
        record['plan']['date']=datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
        self.enter();self.page.evaluate('navigate("tracking","clock-fixture")');length=self.page.evaluate('history.length')
        self.page.locator('[data-action="start"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['status'],'Em andamento')
        self.assertEqual(self.page.locator('[data-action="next"]').count(),1)
        self.assertEqual(self.page.evaluate('history.length'),length)
        self.page.locator('[data-action="pause"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertTrue(self.records['clock-fixture']['paused']);self.assertEqual(self.page.locator('[data-action="resume"]').count(),1)

    def test_reapplying_old_clock_preserves_explicit_microseconds(self):
        self.edit();self.page.locator('[name="note"]').fill('RASCUNHO')
        self.page.evaluate('async()=>await IASDPIDrafts.flush()')
        self.records['clock-fixture']['version']=2
        self.records['clock-fixture']['executions'][self.parent]['started']='2026-10-10T09:30:12.999999-03:00'
        self.page.once('dialog',lambda d:d.accept());self.page.reload();self.page.wait_for_selector('[data-draft-compare]')
        self.page.locator('[data-draft-compare]').click();self.page.wait_for_selector('[data-conflict-dialog][open]');self.page.wait_for_function('()=>!state.busy')
        checkbox=self.page.get_by_role('checkbox',name=re.compile('Reaplicar Atividade 1:.*Início'))
        checkbox.check();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-conflict-apply]').click()
        self.page.wait_for_function('()=>!state.busy&&!document.querySelector("[data-conflict-dialog]").open')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="start"]').input_value(),'09:30:12')
        self.save();self.assertEqual(self.records['clock-fixture']['executions'][self.parent]['started'],'2026-10-10T09:30:12.123456-03:00')
        self.assertEqual(self.records['clock-fixture']['executions'][self.parent]['ended'],self.original['executions'][self.parent]['ended'])

    def test_unselected_old_clock_keeps_latest_microseconds(self):
        self.edit();self.page.locator('[name="note"]').fill('NOTA ANTIGA')
        self.records['clock-fixture']['version']=2
        self.records['clock-fixture']['executions'][self.parent]['started']='2026-10-10T09:30:12.999999-03:00'
        self.save();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.select_and_apply();self.save()
        self.assertEqual(self.records['clock-fixture']['executions'][self.parent]['started'],'2026-10-10T09:30:12.999999-03:00')

    def test_outbox_release_is_scoped_and_old_draft_copy_retained(self):
        self.conflict()
        self.page.evaluate('''async()=>new Promise(resolve=>{const r=indexedDB.open('iasdpi-pending-writes-v1');r.onsuccess=()=>{const db=r.result,tx=db.transaction('writes','readwrite');tx.objectStore('writes').put({key:'unrelated',uid:IASDPIAuth.session().user.id,args:{p_request_id:'different-request',p_id:'different-record',p_expected_version:1,p_document:{}}});tx.oncomplete=()=>{db.close();resolve();};};})''')
        self.select_and_apply()
        rows=self.page.evaluate('''async()=>new Promise(resolve=>{const r=indexedDB.open('iasdpi-pending-writes-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('writes').objectStore('writes').getAll();q.onsuccess=()=>{resolve(q.result.map(row=>row.args.p_request_id));db.close();};};})''')
        self.assertEqual(rows,['different-request']);self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_reordered_planning_is_preserved_for_manual_review(self):
        record=self.records['clock-fixture'];record.update(status='Planejamento',executions={},actual_details={})
        self.enter();self.page.evaluate('navigate("plan-edit","clock-fixture")')
        self.page.locator('.item-editor').nth(1).locator('[data-action="up"]').click();self.page.wait_for_function('()=>!state.busy')
        # Consulta a comparação diretamente: a ordem inválida não deve ser gravada para provocar conflito.
        record['version']=2;self.page.evaluate('async()=>await IASDPIConflicts.open(document.querySelector("#program-form"),{code:"40001"})')
        self.page.wait_for_selector('[data-conflict-dialog][open]')
        order=self.page.get_by_role('checkbox',name='Reaplicar Ordem das atividades / subatividades')
        self.assertTrue(order.is_disabled());self.assertIn('Reordene manualmente',self.page.locator('[data-conflict-dialog]').inner_text())
        self.assertEqual(self.records['clock-fixture']['plan']['items'],self.original['plan']['items'])

    def test_forward_cancel_preserves_edited_form(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")');self.page.evaluate('navigate("history")')
        self.page.go_back();self.page.wait_for_selector('#actuals-form');self.page.locator('[name="note"]').fill('PENDENTE AO AVANÇAR')
        self.page.once('dialog',lambda d:d.dismiss());self.page.go_forward();self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'PENDENTE AO AVANÇAR')
        self.page.once('dialog',lambda d:d.accept());self.page.go_forward();self.page.wait_for_function('()=>state.page==="history"')
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_private_direct_link_after_login_returns_requested_record(self):
        self.page.goto(self.base+'#actuals/clock-fixture');self.page.wait_for_selector('#auth-login-form')
        self.page.locator('[name="email"]').fill('test@example.invalid');self.page.locator('[name="password"]').fill('correct-password');self.page.locator('#auth-login-form button').click()
        self.page.wait_for_function('()=>!bootInProgress&&!state.busy&&IASDPIAuth.allowed()')
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-id'),'clock-fixture')
        self.assertEqual(self.page.evaluate('location.hash'),'#actuals/clock-fixture')

    def test_focus_text_and_field_contrast_meet_relevant_thresholds(self):
        self.edit()
        def luminance(color):
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip((.2126,.7152,.0722),rgb))
        def contrast(a,b):
            x,y=sorted((luminance(a),luminance(b)));return (y+.05)/(x+.05)
        colors=self.page.evaluate('()=>{const s=getComputedStyle(document.documentElement);return {focus:s.getPropertyValue("--blue").trim(),text:s.getPropertyValue("--muted").trim()}}')
        self.assertGreaterEqual(contrast(colors['focus'],'#ffffff'),3)
        self.assertGreaterEqual(contrast(colors['text'],'#ffffff'),4.5)
        self.assertGreaterEqual(contrast('#7a8790','#ffffff'),3)

    def test_failed_local_safety_copy_blocks_rebase_without_losing_fields(self):
        self.conflict();self.page.evaluate('async()=>{await IASDPIDrafts.flush();crypto.subtle.encrypt=()=>Promise.reject(Error("Falha local simulada"));}')
        self.page.locator('[data-conflict-choice]:enabled').first.check();self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-conflict-apply]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertTrue(self.page.locator('[data-conflict-dialog]').is_visible())
        self.assertIn('Nenhuma seleção foi reaplicada',self.page.locator('.conflict-feedback').inner_text())
        self.assertEqual(self.page.locator('#actuals-form').get_attribute('data-version'),'1')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'MINHA EDIÇÃO LOCAL')
        self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_notes_second_edit_draft_and_conflict_use_last_confirmed_version(self):
        self.enter();self.page.evaluate('navigate("summary","clock-fixture")')
        self.page.locator('#notes-form [name="note"]').fill('NOTA CONFIRMADA')
        self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['version'],2)
        self.page.locator('#notes-form [name="incident"]').fill('SEGUNDA EDIÇÃO EM RASCUNHO')
        self.page.evaluate('async()=>await IASDPIDrafts.flush()')
        version=self.page.evaluate('()=>IASDPIDrafts.comparison(document.querySelector("#notes-form")).version')
        self.assertEqual(version,2)
        self.page.once('dialog',lambda d:d.accept());self.page.reload();self.page.wait_for_selector('[data-draft-restore]')
        self.assertTrue(self.page.locator('[data-draft-restore]').is_enabled())
        self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('[name="incident"]').input_value(),'SEGUNDA EDIÇÃO EM RASCUNHO')
        self.records['clock-fixture']['version']=3;self.records['clock-fixture']['note']='TERCEIRA NOTA DO BANCO'
        self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_selector('[data-conflict-dialog][open]')
        self.assertIn('Sua edição: versão 2',self.page.locator('[data-conflict-dialog]').inner_text())
        self.select_and_apply();self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['version'],4)
        self.assertEqual(self.records['clock-fixture']['note'],'TERCEIRA NOTA DO BANCO')
        self.assertEqual(self.records['clock-fixture']['incident'],'SEGUNDA EDIÇÃO EM RASCUNHO')
