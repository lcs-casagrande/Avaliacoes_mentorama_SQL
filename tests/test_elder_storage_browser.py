"""G5: portal integrado real + Auth/RPC simulados; sem rede externa."""
import unittest
import shutil
import subprocess
from pathlib import Path
import test_portal_integration_browser as g4
import test_frontend_access as base

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ElderStorageBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        g4.PortalIntegrationBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--elder-storage-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(g4.PortalIntegrationBrowserTests.tearDownClass.__func__)
    setUp=g4.PortalIntegrationBrowserTests.setUp
    tearDown=g4.PortalIntegrationBrowserTests.tearDown
    go=g4.PortalIntegrationBrowserTests.go
    choose=g4.PortalIntegrationBrowserTests.choose
    def login(self,alias='anciao.teste'):
        self.choose();self.page.fill('#portal-login-form [name=email]',alias);self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.elder-week-calendar')
    def fill(self):
        self.page.locator('[data-elder-action=prefill]').click();self.assertTrue(all(e.input_value() for e in self.page.locator('[data-elder-person]').all()))
    def save(self,publish=False):
        if publish:self.page.once('dialog',lambda d:d.accept())
        self.page.locator('[data-elder-action='+('publish' if publish else 'save')+']').click();self.page.wait_for_function("()=>/Rascunho salvo|Escala publicada/.test(document.querySelector('#elder-feedback')?.textContent)")
    def public(self,month):
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate('(month)=>{IASDPIScheduleCalendar.show({month,department:"Ancionato"});render();}',month)
        self.page.wait_for_function("()=>!document.querySelector('.portal-feed-state')?.textContent.includes('Carregando')")
    def test_week_draft_private_publication_and_version_history(self):
        self.login();self.fill();month=self.page.locator('#elder-month-value').input_value();self.save();self.page.locator('[data-elder-history]').first.click();self.page.wait_for_selector('.elder-history');self.assertIn('Versão 1',self.page.locator('.elder-history').inner_text());self.public(month);self.assertEqual(self.page.evaluate('IASDPIPortalAccess.feedRows("'+month+'").length'),0)
        self.go('schedule-build');self.page.wait_for_selector('.elder-week-calendar');self.save(True);self.public(month);self.assertGreater(self.page.locator('.scale-band.scale-weekly').count(),0);self.assertTrue(self.page.evaluate('IASDPIPortalAccess.feedRows("'+month+'").every(r=>r.kind==="weekly")'))
    def test_monthly_twelve_months_publish_does_not_save_pending_week(self):
        self.login();select=self.page.locator('[data-elder-person]').first;person=select.locator('option:not([value=""])').first.get_attribute('value');select.select_option(person);self.page.locator('[data-kind=monthly]').click();self.fill();self.save(True)
        self.assertTrue(self.page.evaluate('[...IASDPIB1Preview.elderPeriods.values()].every(r=>r.kind==="monthly"&&r.status==="published")'));self.page.locator('[data-kind=weekly]').click();self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),person);self.assertIn('Alterações pendentes',self.page.locator('#elder-feedback').inner_text())
    def test_editor_without_publish_and_reader_have_distinct_permissions(self):
        self.login('anciao.editor.teste');self.fill();self.save();self.assertEqual(self.page.locator('[data-elder-action=publish]').count(),0)
        message=self.page.evaluate("async()=>{try{const c=await IASDPISchedules.request('iasdpi_schedule_catalog');await IASDPISchedules.request('iasdpi_schedule_elder_save',{p_department:c.departments[0].id,p_status:'published',p_rows:[],p_request_id:crypto.randomUUID()});return '';}catch(e){return e.message;}}")
        self.assertIn('Sem publicação',message)
    def test_reader_can_consult_but_not_edit_and_no_production_calls(self):
        self.login('anciao.leitura.teste');self.assertEqual(self.page.locator('[data-elder-action=save],[data-elder-action=publish],[data-elder-action=prefill]').count(),0);self.assertTrue(self.page.locator('[data-elder-person]').first.is_disabled());self.assertEqual(self.external,[])
    def test_save_failure_preserves_pending_and_retries_same_request(self):
        self.login();self.fill();before=self.page.locator('[data-elder-person]').first.input_value();self.page.evaluate("()=>{const rpc=IASDPISchedulePreview.request;let failed=false;window.g5requests=[];IASDPISchedulePreview.request=async(n,b)=>{if(n==='iasdpi_schedule_elder_save'){g5requests.push(b.p_request_id);if(!failed){failed=true;throw Error('Falha temporária fictícia');}}return rpc(n,b);};}")
        self.page.locator('[data-elder-action=save]').click();self.page.wait_for_selector('main [role=alert]');self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),before);self.save();self.assertEqual(len(set(self.page.evaluate('g5requests'))),1)
    def test_production_path_not_gated_on_demo_flag(self):
        self.login();self.page.evaluate("()=>{const request=IASDPISchedulePreview.request;IASDPISchedules.request=request;delete window.IASDPISchedulePreview;render();}")
        self.page.wait_for_selector('.elder-week-calendar');self.fill();self.save();self.assertIn('confirmadas pelo Supabase',self.page.locator('#elder-feedback').inner_text())
        # Apenas mensagem/caminho de produção sob RPC SIMULADA; não é teste no Supabase.
    def test_mobile_keyboard_and_historical_calendar_preserved(self):
        self.login();labels=self.page.locator('[data-elder-person]').evaluate_all('(fields)=>fields.map(f=>f.getAttribute("aria-label"))');self.assertEqual(len(labels),len(set(labels)));self.page.locator('[data-elder-person]').first.focus();self.page.keyboard.press('Tab');self.assertFalse(self.page.evaluate('document.activeElement===document.body'))
        self.page.locator('[data-elder-person]').first.focus();self.page.mouse.move(0,0)
        out=base.ROOT/'dist/elder-storage';out.mkdir(parents=True,exist_ok=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            if width in [390,1440]:self.page.screenshot(path=str(out/('mobile.png' if width==390 else 'desktop.png')),full_page=True)
        self.page.locator('[data-kind=monthly]').click();self.page.set_viewport_size({'width':390,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);self.page.screenshot(path=str(out/'monthly-mobile.png'),full_page=True);self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)

    def test_bad_save_confirmation_preserves_fields(self):
        self.login();select=self.page.locator('[data-elder-person]').first;person=select.locator('option:not([value=""])').first.get_attribute('value');select.select_option(person)
        self.page.evaluate("()=>{const rpc=IASDPISchedulePreview.request;IASDPISchedulePreview.request=async(n,b)=>n==='iasdpi_schedule_elder_save'?{periods:b.p_rows.map(r=>({...r,status:'draft',version:r.expected_version+1,person_id:null}))}:rpc(n,b);}")
        self.page.locator('[data-elder-action=save]').click();self.page.wait_for_selector('main [role=alert]');self.assertIn('Confirmação de gravação inválida',self.page.locator('main [role=alert]').inner_text());self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),person)
