"""Rascunhos de cópias fictícias; nenhum acesso a contas ou dados de produção."""
import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlsplit

import test_frontend_access as base
import test_operational_browser as operational
import test_hour_format as hours


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Chromium/Playwright')
class DraftTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    save=operational.OperationalBrowserTests.save
    enter=hours.HourFormatBrowserTests.enter

    def setUp(self):
        self.user=base.USER
        self.newer_during_save=False
        hours.HourFormatBrowserTests.setUp(self)
        self.original=copy.deepcopy(self.records['clock-fixture'])

    def supabase(self,route):
        path=urlsplit(route.request.url).path
        if path=='/auth/v1/user':
            return route.fulfill(json={'id':self.user,'email':'test@example.invalid','is_anonymous':False})
        if path=='/rest/v1/iasdpi_access':
            return route.fulfill(json=[{'user_id':self.user,'role':self.role,'enabled':True}] if self.role else [])
        if path.endswith('/iasdpi_save_program') and self.newer_during_save:
            self.newer_during_save=False
            self.page.evaluate("""() => {const e=document.querySelector('.actual-row [name="activity-note"]');e.value='EDIÇÃO MAIS RECENTE';e.dispatchEvent(new Event('input',{bubbles:true}));}""")
        return operational.OperationalBrowserTests.supabase(self,route)

    def edit(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('RASCUNHO SIGILOSO FICTÍCIO')
        self.flush()

    def flush(self):
        self.page.evaluate('async()=>await IASDPIDrafts.flush()')

    def stored(self):
        self.flush()
        return self.page.evaluate("""async()=>{
          const db=await new Promise((resolve,reject)=>{
            const r=indexedDB.open('iasdpi-edit-drafts-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;
          });
          return await new Promise(resolve=>{
            const r=db.transaction('drafts').objectStore('drafts').getAll();
            r.onsuccess=()=>{
              db.close();resolve(r.result.map(row=>({...row,iv:Array.from(row.iv),cipher:Array.from(new Uint8Array(row.cipher))})));
            };
          });
        }""")

    def reload_recover(self):
        self.flush();self.page.once('dialog',lambda d:d.accept());self.page.reload()
        self.page.wait_for_selector('[data-draft-restore="true"]')
        self.page.locator('[data-draft-restore="true"]').click()
        self.page.wait_for_function('()=>!state.busy')

    def test_reproduce_and_fix_auth_failure_reauthentication_and_no_remote_write(self):
        self.edit()
        self.page.route('https://*.supabase.co/auth/v1/user',lambda route:route.abort('internetdisconnected'))
        self.page.evaluate('async()=>{try{await IASDPIAuth.restore();}catch(_){}}')
        self.assertEqual(self.page.evaluate('state.page'),'login')
        self.assertNotIn('RASCUNHO SIGILOSO',self.page.locator('#app').inner_text())
        self.assertEqual(self.records['clock-fixture'],self.original)
        self.page.unroute('https://*.supabase.co/auth/v1/user')
        self.page.evaluate('async()=>await IASDPIAuth.restore()')
        self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!bootInProgress')
        self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.wait_for_selector('[data-draft-restore="true"]')
        self.page.locator('[data-draft-restore="true"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'RASCUNHO SIGILOSO FICTÍCIO')
        self.assertEqual(self.records['clock-fixture'],self.original)
        self.assertIn('local',self.page.locator('.draft-feedback').inner_text())
        self.assertIn('não salvo',self.page.locator('.draft-feedback').inner_text())

    def test_reload_restores_optional_times_children_responsible_and_microseconds(self):
        self.edit();row=self.page.locator('.actual-row').nth(1)
        row.locator('[name="start"]').fill('09:35:23')
        row.locator('[name="responsible-option"]').select_option('other')
        row.locator('[name="responsible-name"]').fill('Equipe fictícia')
        row.locator('[data-action="add-subactivity"]').click();self.page.wait_for_function('()=>!state.busy')
        row.locator('[name="sub-title"]').fill('Subatividade recuperada')
        row.locator('[name="sub-start"]').fill('09:36:17');row.locator('[name="sub-end"]').fill('09:37:29')
        self.reload_recover()
        row=self.page.locator('.actual-row').nth(1)
        self.assertEqual(row.locator('[name="start"]').input_value(),'09:35:23')
        self.assertEqual(row.locator('[name="responsible-name"]').input_value(),'Equipe fictícia')
        self.assertEqual(row.locator('[name="sub-title"]').input_value(),'Subatividade recuperada')
        self.save()
        saved=self.records['clock-fixture']
        self.assertEqual(saved['executions'][self.parent],self.original['executions'][self.parent])
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'],self.original['actual_details'][self.parent]['subactivities'])
        # O salvamento existente canonicaliza HH:mm:00 para HH:mm, mantendo o horário.
        expected=copy.deepcopy(self.original['plan'])
        for item in [expected]+expected['items']:
            for key in ('start','end'):item[key]=item[key][:5]
        self.assertEqual(saved['plan'],expected);self.assertEqual(len(self.records),1)
        self.assertEqual(self.stored(),[])

    def test_plan_new_fields_rows_order_and_navigation_cancel_or_keep(self):
        self.enter();self.page.evaluate('state.selected=null;navigate("edit")')
        self.page.locator('#program-form [name="name"]').fill('Programação em rascunho')
        row=self.page.locator('.item-editor').first;row.locator('[name="activity"]').fill('Atividade em rascunho')
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('nav [data-page="organization"]').click()
        self.assertEqual(self.page.locator('#program-form [name="name"]').input_value(),'Programação em rascunho')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('nav [data-page="organization"]').click()
        self.page.evaluate('state.selected=null;navigate("edit")')
        self.page.wait_for_selector('[data-draft-restore="true"]');self.page.locator('[data-draft-restore="true"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('#program-form [name="name"]').input_value(),'Programação em rascunho')
        self.assertEqual(self.page.locator('.item-editor [name="activity"]').first.input_value(),'Atividade em rascunho')
        self.assertEqual(len(self.records),1)

    def test_summary_notes_recover_after_reload_then_save_same_id(self):
        self.enter();self.page.evaluate('navigate("summary","clock-fixture")')
        self.page.locator('#notes-form [name="note"]').fill('Observações recuperáveis')
        self.page.locator('#notes-form [name="incident"]').fill('Ocorrência em rascunho')
        self.reload_recover()
        self.assertEqual(self.page.locator('#notes-form [name="note"]').input_value(),'Observações recuperáveis')
        self.page.locator('#notes-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['note'],'Observações recuperáveis')
        self.assertEqual(self.records['clock-fixture']['incident'],'Ocorrência em rascunho')
        self.assertEqual(self.stored(),[]);self.assertEqual(len(self.records),1)

    def test_user_b_never_sees_user_a_draft(self):
        self.edit()
        self.page.route('https://*.supabase.co/auth/v1/user',lambda route:route.abort('internetdisconnected'))
        self.page.evaluate('async()=>{try{await IASDPIAuth.restore();}catch(_){}}')
        self.page.unroute('https://*.supabase.co/auth/v1/user')
        self.user='22222222-2222-4222-8222-222222222222'
        self.login();self.page.wait_for_function('(uid)=>IASDPIAuth.session()?.user.id===uid&&!bootInProgress&&!state.busy',arg=self.user)
        self.page.evaluate('navigate("actuals","clock-fixture")');self.flush()
        self.assertEqual(self.page.locator('[data-draft-restore]').count(),0)
        self.assertNotIn('RASCUNHO SIGILOSO',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'Nota')
        self.assertEqual({row['uid'] for row in self.stored()},{base.USER})

    def test_expired_session_relogin_finds_draft(self):
        self.edit()
        self.page.evaluate("""()=>{const key=IASDPIStorage.authSession,value=JSON.parse(localStorage.getItem(key));value.expires_at=1;localStorage.setItem(key,JSON.stringify(value));}""")
        self.expiry=1;self.page.once('dialog',lambda d:d.accept());self.page.reload()
        self.page.wait_for_selector('#auth-login-form')
        self.assertEqual(self.page.locator('[data-draft-restore]').count(),0)
        self.expiry=3600;self.login();self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!state.busy&&!bootInProgress')
        self.page.evaluate('navigate("actuals","clock-fixture")');self.page.wait_for_selector('[data-draft-restore]')
        self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'RASCUNHO SIGILOSO FICTÍCIO')

    def test_explicit_logout_clears_drafts_without_changing_records(self):
        self.edit();self.assertEqual(len(self.stored()),1)
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#auth-logout').click()
        self.page.wait_for_function('()=>!state.busy&&!IASDPIAuth.allowed()')
        self.assertEqual(self.stored(),[]);self.assertEqual(self.records['clock-fixture'],self.original)
        self.assertNotIn('RASCUNHO',self.page.locator('#app').inner_text())

    def test_cipher_has_no_plaintext_and_key_is_nonextractable(self):
        self.edit();stored=self.stored()
        self.assertEqual(len(stored),1)
        self.assertNotIn('SIGILOSO',json.dumps(stored))
        self.assertNotIn('access_token',json.dumps(stored))
        self.assertEqual(self.page.evaluate("""async()=>{const r=indexedDB.open('iasdpi-edit-drafts-v1');return await new Promise(resolve=>r.onsuccess=()=>{const q=r.result.transaction('keys').objectStore('keys').getAll();q.onsuccess=()=>resolve(q.result.map(row=>row.value.extractable));});}"""),[False])

    def test_expiration_and_changed_server_version_do_not_overwrite(self):
        self.edit();self.records['clock-fixture']['version']=2;self.records['clock-fixture']['note']='Atualização de outro dispositivo'
        self.flush();self.page.once('dialog',lambda d:d.accept());self.page.reload()
        self.page.wait_for_selector('.draft-offer')
        self.assertTrue(self.page.locator('[data-draft-restore]').is_disabled())
        self.page.locator('.draft-offer button',has_text='Consultar rascunho').click();self.page.wait_for_selector('.draft-preview')
        self.assertIn('RASCUNHO SIGILOSO',self.page.locator('.draft-preview').inner_text())
        self.assertEqual(self.records['clock-fixture']['note'],'Atualização de outro dispositivo')
        self.page.evaluate("""async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('iasdpi-edit-drafts-v1');r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('drafts','readwrite'),s=tx.objectStore('drafts'),r=s.getAll();r.onsuccess=()=>{for(const row of r.result){row.expiresAt=Date.now()-1;s.put(row)}};tx.oncomplete=resolve});db.close();}""")
        self.page.reload();self.page.wait_for_selector('#actuals-form');self.flush()
        self.assertEqual(self.stored(),[])
        self.assertEqual(self.page.locator('[data-draft-restore]').count(),0)

    def test_newer_edits_survive_confirmation_of_older_save(self):
        self.edit();self.newer_during_save=True;self.save()
        self.assertEqual(self.records['clock-fixture']['actual_details'][self.parent]['note'],'RASCUNHO SIGILOSO FICTÍCIO')
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'EDIÇÃO MAIS RECENTE')
        self.assertTrue(self.page.evaluate('registrationDirty'));self.assertEqual(len(self.stored()),1)
        self.assertEqual(self.stored()[0]['baseVersion'],2)
        self.reload_recover();self.save()
        self.assertEqual(self.records['clock-fixture']['actual_details'][self.parent]['note'],'EDIÇÃO MAIS RECENTE')
        self.assertEqual(self.stored(),[])

    def test_save_error_keeps_draft_and_cancel_discards_only_unsaved_values(self):
        self.edit();self.fail_write=True;self.save()
        self.assertIn('Nenhuma confirmação',self.page.locator('.form-error').inner_text())
        self.assertEqual(len(self.stored()),1);self.assertEqual(self.records['clock-fixture'],self.original)
        self.fail_write=False;self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-action="cancel-record"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.stored(),[]);self.assertEqual(self.records['clock-fixture'],self.original)

    def test_revoked_account_cannot_unlock_draft(self):
        self.edit();self.role=''
        self.page.evaluate('async()=>{try{await IASDPIAuth.restore();}catch(_){}}')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertNotIn('RASCUNHO SIGILOSO',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('[data-draft-restore]').count(),0)
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_new_tab_recovers_old_tab_draft_and_save_removes_only_confirmed_revisions(self):
        self.edit();self.page.close()
        self.page=self.context.new_page();self.page.route('https://*.supabase.co/**',self.supabase)
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.goto(self.base+'#actuals/clock-fixture')
        self.page.wait_for_selector('[data-draft-restore]');self.page.locator('[data-draft-restore]').click()
        self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'RASCUNHO SIGILOSO FICTÍCIO')
        self.save();self.assertEqual(self.stored(),[])

    def test_two_tabs_keep_independent_drafts_and_logout_purges_both(self):
        self.edit();first=self.page
        second=self.context.new_page();second.route('https://*.supabase.co/**',self.supabase)
        second.goto(self.base+'#actuals/clock-fixture');second.wait_for_selector('#actuals-form')
        second.locator('.actual-row [name="activity-note"]').first.fill('RASCUNHO DA SEGUNDA ABA')
        second.evaluate('async()=>await IASDPIDrafts.flush()')
        self.assertEqual(len(self.stored()),2)
        self.save();self.assertEqual(len(self.stored()),1)
        self.assertEqual(self.records['clock-fixture']['actual_details'][self.parent]['note'],'RASCUNHO SIGILOSO FICTÍCIO')
        first.once('dialog',lambda d:d.accept())
        first.locator('#auth-logout').click();first.wait_for_function('()=>!state.busy&&!IASDPIAuth.allowed()')
        second.wait_for_function('()=>!IASDPIAuth.allowed()');second.evaluate('async()=>await IASDPIDrafts.flush()')
        self.assertEqual(self.stored(),[])
        self.assertNotIn('RASCUNHO DA SEGUNDA ABA',second.locator('#app').inner_text())
        second.close()

    def test_disabled_indexeddb_warns_and_preserves_encrypted_memory_until_reauthentication(self):
        self.enter();self.page.evaluate("()=>{indexedDB.open=()=>{throw Error('Indisponível no teste')}}")
        self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.locator('.actual-row [name="activity-note"]').first.fill('RASCUNHO SOMENTE NA ABA')
        self.flush();self.assertIn('somente nesta aba',self.page.locator('.draft-feedback').inner_text())
        self.page.route('https://*.supabase.co/auth/v1/user',lambda route:route.abort('internetdisconnected'))
        self.page.evaluate('async()=>{try{await IASDPIAuth.restore();}catch(_){}}')
        self.page.unroute('https://*.supabase.co/auth/v1/user')
        self.page.evaluate('async()=>await IASDPIAuth.restore()');self.page.wait_for_function('()=>!bootInProgress&&IASDPIAuth.allowed()')
        self.page.evaluate('navigate("actuals","clock-fixture")');self.page.wait_for_selector('[data-draft-restore]')
        self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'RASCUNHO SOMENTE NA ABA')
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_new_plan_save_keeps_created_id_and_cleans_new_form_draft(self):
        self.enter();self.page.evaluate('state.selected=null;navigate("edit")')
        self.page.locator('#program-form [name="name"]').fill('Novo planejamento fictício')
        row=self.page.locator('.item-editor').first
        row.locator('[name="activity"]').fill('Atividade de teste')
        row.locator('[name="start"]').fill('09:30');row.locator('[name="end"]').fill('09:35')
        self.flush();self.assertEqual(len(self.stored()),1)
        self.page.locator('#program-form [type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(len(self.records),2)
        self.assertEqual(self.stored(),[])
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_draft_notice_fits_supported_viewports(self):
        self.edit()
        for width in (360,390,768,1024,1440):
            self.page.set_viewport_size({'width':width,'height':900})
            box=self.page.locator('#drafts-notice').bounding_box()
            self.assertGreaterEqual(box['x'],0)
            self.assertLessEqual(box['x']+box['width'],width)

    def test_cancel_logout_keeps_session_and_drafts(self):
        self.edit();self.page.once('dialog',lambda d:d.dismiss());self.page.locator('#auth-logout').click()
        self.page.wait_for_function('()=>!state.busy')
        self.assertTrue(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(len(self.stored()),1)
        self.assertEqual(self.page.locator('.actual-row [name="activity-note"]').first.input_value(),'RASCUNHO SIGILOSO FICTÍCIO')

    def test_review_html_contains_drafts_and_blocks_remote_writes(self):
        with tempfile.TemporaryDirectory(prefix='iasdpi-drafts-preview-') as directory:
            html=Path(directory)/'preview.html'
            subprocess.run([sys.executable,str(base.ROOT/'scripts/export_preview.py'),'--read-only','--output',str(html)],check=True,capture_output=True)
            content=html.read_text()
            self.assertIn('window.IASDPIDrafts=',content)
            self.assertIn("storageMode:'browser',remoteReadOnly:true,environment:'validation'",content)
            self.assertNotIn('<script src=',content)

    def test_logout_storage_failure_is_reported_without_leaving_session_active(self):
        self.edit()
        self.page.evaluate("()=>{indexedDB.open=()=>{throw Error('Limpeza bloqueada no teste')}}")
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#auth-logout').click()
        self.page.wait_for_function('()=>!state.busy')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertIn('impediu a limpeza',self.page.locator('#notice').inner_text())
        self.assertNotIn('RASCUNHO SIGILOSO',self.page.locator('#app').inner_text())
        self.assertEqual(self.records['clock-fixture'],self.original)
