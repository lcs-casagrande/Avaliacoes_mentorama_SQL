"""Pages no mesmo caminho: registros legados preservados e Supabase sem escrita."""
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

import test_frontend_access as base

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pages_builder', ROOT / 'scripts/build_homologation.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class ExistingPagesTests(base.FrontendAccessTests):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='iasdpi-pages-')
        site = Path(cls.directory.name) / 'Avaliacoes_mentorama_SQL'
        builder.build(site, 'https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/', preserve_local=True)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), partial(base.QuietHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.http.server_port) + '/Avaliacoes_mentorama_SQL/'
        cls.pw = base.sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.directory.cleanup()

    def test_release_uses_old_keys_and_versioned_assets(self):
        self.open()
        self.assertEqual(self.page.evaluate('IASDPIStorage.programs'), 'iasdpi-demo-v1')
        self.assertTrue(self.page.evaluate('IASDPIConfig.remoteReadOnly'))
        self.assertIn('VALIDAÇÃO', self.page.locator('#validation-banner').inner_text())
        self.assertTrue(self.page.evaluate("[...document.scripts].every(s=>s.src.includes('?v='))"))
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_release_rejects_cloud_and_admin_writes(self):
        self.role = 'admin'
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.isAdmin() && !state.busy')
        posts = []
        self.page.on('request', lambda request: posts.append(request.url) if request.method != 'GET' else None)
        denied = self.page.evaluate('''async()=>{
          const results=[];
          for(const name of ['iasdpi_set_access','iasdpi_create_invite','iasdpi_revoke_invite','iasdpi_accept_invite']){
            try{await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',body:'{}'});results.push(false);}catch(_){results.push(true);}
          }
          try{await cloudSave();results.push(false);}catch(_){results.push(true);}
          await cloudAutoArchive();
          return results;
        }''')
        self.assertTrue(all(denied))
        self.assertEqual(posts, [])
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_backup_roundtrip_does_not_replace_existing_records(self):
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        result = self.page.evaluate('''async()=>{
          const backup=await backupPayload();
          const encrypted=await encryptBackup(backup,'backup-password-test');
          const decoded=await decryptBackup(encrypted,'backup-password-test');
          const same=await restoreBackup(decoded);
          decoded.programs[0].note='Versão diferente';
          const changed=await restoreBackup(decoded);
          return {same,changed,programs:JSON.parse(localStorage.getItem('iasdpi-demo-v1'))};
        }''')
        self.assertEqual(result['same'], {'added': 0, 'copies': 0})
        self.assertEqual(result['changed'], {'added': 1, 'copies': 1})
        self.assertEqual(result['programs'][0], json.loads(self.raw)[0])
        self.assertEqual(len(result['programs']), 2)

    def test_persisted_session_recovers_after_reload_and_refresh(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        requests=[]
        self.page.on('request',lambda r:requests.append(r.url) if r.method=='POST' else None)
        self.page.reload()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.assertEqual(requests,[])
        self.page.evaluate('''()=>{const key=IASDPIStorage.authSession;const value=JSON.parse(localStorage.getItem(key));value.expires_at=1;localStorage.setItem(key,JSON.stringify(value));}''')
        self.page.reload()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.assertTrue(any('grant_type=refresh_token' in url for url in requests))
        self.assertFalse(any('grant_type=password' in url for url in requests))
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_recovered_identity_does_not_bypass_revocation(self):
        self.open()
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed()')
        self.role=''
        self.page.reload()
        self.page.wait_for_function('() => IASDPIAuth.status().phase!=="recovering"')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.page.evaluate('state.programs.length'),0)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)

    def test_sdk_session_recovers_in_reopened_browser_profile(self):
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        context=self.browser.new_context(storage_state=self.context.storage_state(),viewport={'width':390,'height':844})
        try:
            page=context.new_page();page.route('https://*.supabase.co/**',self.supabase)
            posts=[];page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
            page.goto(self.base+'#history')
            page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
            self.assertEqual(posts,[])
            self.assertEqual(page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),self.raw)
        finally:context.close()

    def test_return_from_background_recovers_after_network_failure(self):
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        route='https://*.supabase.co/auth/v1/user'
        self.page.route(route,lambda r:r.abort('internetdisconnected'))
        self.page.evaluate('async()=>{try{await IASDPIAuth.restore();}catch(_){}}')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertIsNotNone(self.page.evaluate('localStorage.getItem(IASDPIStorage.authSession)'))
        self.page.unroute(route)
        self.page.evaluate('document.dispatchEvent(new Event("visibilitychange"))')
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),self.raw)

    def test_correct_date_preserves_sixteen_activities_and_other_records(self):
        self.open()
        original=json.loads(self.raw)[0]
        original.update(status='Finalizada',note='Anotações do culto',incident='Ocorrência preservada')
        for item in original['plan']['items']:
            original['executions'][item['id']]={'started':item['planned_start'],'ended':item['planned_end']}
            original['actual_details'][item['id']]={'responsible':'Responsável teste','note':'Observação '+item['id']}
        original['extra_events']=[{'id':'extra-test','position':16,'activity':'Evento adicional','start':'11:25:17','end':'11:26:20','note':'Extra preservado','responsible':'Equipe'}]
        other=json.loads(self.raw)[0];other['id']='other-record';other['note']='Não alterar'
        raw=json.dumps([original,other],ensure_ascii=False)
        self.page.evaluate('(raw)=>localStorage.setItem("iasdpi-demo-v1",raw)',raw)
        self.page.evaluate("localStorage.setItem(IASDPIStorage.safety,'BACKUP ANTERIOR PRESERVADO')")
        self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===2')
        self.page.evaluate('navigate("summary","test-program")')
        self.page.locator('[data-action="correct-date"]').click()
        self.page.wait_for_selector('#correct-date-dialog[open]')
        self.assertIn('16 atividades',self.page.locator('#correct-date-preview').inner_text())
        self.page.locator('#correct-date-cancel').click()
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),raw)
        self.page.locator('[data-action="correct-date"]').click()
        self.page.locator('#correct-date-confirm').click()
        self.page.wait_for_function('() => JSON.parse(localStorage.getItem("iasdpi-demo-v1"))[0].plan.date==="2026-10-10"')
        records=self.page.evaluate('JSON.parse(localStorage.getItem("iasdpi-demo-v1"))')
        self.assertEqual(len(records),2);self.assertEqual(records[1],other)
        corrected=records[0]
        self.assertEqual(corrected['id'],original['id'])
        self.assertEqual(len(corrected['plan']['items']),16)
        for field in ['actual_details','extra_events','note','incident','status']:
            self.assertEqual(corrected[field],original[field])
        for item,before in zip(corrected['plan']['items'],original['plan']['items']):
            for field in before:
                if field not in ['planned_start','planned_end']:self.assertEqual(item[field],before[field])
        for key,before in original['executions'].items():
            for field,value in before.items():
                self.assertEqual(corrected['executions'][key][field][:10],'2026-10-10')
                self.assertEqual(corrected['executions'][key][field][10:],value[10:])
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem(IASDPIStorage.dateCorrections)).records[0].program'),original)
        self.assertEqual(self.page.evaluate('localStorage.getItem(IASDPIStorage.safety)'),'BACKUP ANTERIOR PRESERVADO')
        self.assertNotIn('03/10/2026',self.page.locator('#app .page-heading').inner_text() if self.page.locator('#app .page-heading').count() else self.page.locator('#app h1').inner_text())

    def test_correction_rejects_stale_preview_without_writing(self):
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.page.evaluate('navigate("summary","test-program")')
        self.page.locator('[data-action="correct-date"]').click()
        self.page.wait_for_selector('#correct-date-dialog[open]')
        self.page.wait_for_function('() => !state.busy')
        changed=self.page.evaluate('''()=>{const rows=JSON.parse(localStorage.getItem('iasdpi-demo-v1'));rows[0].note='Alterado em outra aba';const raw=JSON.stringify(rows);localStorage.setItem('iasdpi-demo-v1',raw);return raw;}''')
        self.page.locator('#correct-date-confirm').click()
        self.page.wait_for_function('() => !state.busy')
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),changed)
        self.assertIn('mudou',self.page.locator('#notice').inner_text())

    def test_correction_is_idempotent_and_rejects_unexpected_dates(self):
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        outcome=self.page.evaluate('''async()=>{
          const original=JSON.parse(localStorage.getItem('iasdpi-demo-v1'))[0];
          const invalid=structuredClone(original);invalid.executions[invalid.plan.items[0].id]={started:'2026-10-04T09:32:17-03:00',ended:null};
          let refused=false;try{correctedCultoDate(invalid);}catch(_){refused=true;}
          const changed=await api('programs/'+original.id+'/correct-date','PUT',{version:original.version,expected:JSON.stringify(original)});
          const raw=localStorage.getItem('iasdpi-demo-v1');
          let twice=false;try{await api('programs/'+changed.id+'/correct-date','PUT',{version:changed.version,expected:JSON.stringify(changed)});}catch(_){twice=true;}
          return {refused,twice,unchanged:raw===localStorage.getItem('iasdpi-demo-v1'),count:JSON.parse(raw).length};
        }''')
        self.assertEqual(outcome,{'refused':True,'twice':True,'unchanged':True,'count':1})

    def test_logout_clears_sdk_session_and_private_correction_preview(self):
        self.open();self.login()
        self.page.wait_for_function('() => IASDPIAuth.allowed() && state.programs.length===1')
        self.page.evaluate('navigate("summary","test-program")')
        self.page.locator('[data-action="correct-date"]').click()
        self.page.wait_for_selector('#correct-date-dialog[open]')
        self.page.evaluate('async()=>{await IASDPIAuth.logout();}')
        self.assertEqual(self.page.locator('#correct-date-preview').inner_text(),'')
        self.assertFalse(self.page.evaluate('document.querySelector("#correct-date-dialog").open'))
        self.assertIsNone(self.page.evaluate('localStorage.getItem(IASDPIStorage.authSession)'))
        self.assertEqual(self.page.evaluate('localStorage.getItem("iasdpi-demo-v1")'),self.raw)
        self.page.reload();self.page.wait_for_function('() => IASDPIAuth.status().phase!=="recovering"')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
