"""G7: interação real em Chromium, provedor fictício/CSP sem rede externa."""
from pathlib import Path
import subprocess
import unittest
import test_governance_integration_browser as g6
import test_portal_integration_browser as g4
import test_frontend_access as base
D='00000000-0000-4000-8000-000000000001'
M='00000000-0000-4000-8000-000000000003'

class DepartmentDaysBrowserTests(g6.GovernanceIntegrationBrowserTests):
    @classmethod
    def setUpClass(cls):
        g4.PortalIntegrationBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--department-days-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    def open_days(self):
        box=self.page.locator('.department-days');
        if not box.evaluate('e=>e.open'):box.locator('summary').click()
        return box
    def set_days(self,days):
        box=self.open_days()
        for day in range(7):box.locator('[name=weekday][value="'+str(day)+'"]').set_checked(day in days)
        box.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-days-status]')?.textContent.includes('Dias salvos')")
    def test_g7_configuration_persists_across_routes_not_page_reload_and_preserves_plan(self):
        self.admin();self.prefill();self.save();before=self.page.evaluate('JSON.stringify([...IASDPIB1Preview.plans.values()])');self.set_days([6]);self.assertEqual(before,self.page.evaluate('JSON.stringify([...IASDPIB1Preview.plans.values()])'))
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.go('schedule-build');self.page.wait_for_selector('.department-days');self.open_days();self.assertEqual(self.page.locator('#department-days-form [name=weekday]:checked').evaluate_all('es=>es.map(e=>Number(e.value))'),[6]);self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
    def test_g7_rotation_only_configured_days_keeps_existing_assignments(self):
        self.admin();self.set_days([6]);self.prefill()
        self.assertFalse(self.page.evaluate("()=>[...document.querySelectorAll('[data-calendar-volunteer]')].some(s=>s.value&&new Date(s.closest('.monthly-cell').querySelector('[data-day]').dataset.day+'T12:00:00Z').getUTCDay()!==6)"))
        self.set_days([]);self.prefill();self.assertGreater(self.page.locator('[data-calendar-volunteer]').evaluate_all('es=>es.filter(e=>e.value).length'),0)
    def test_g7_generate_new_configured_days_without_erasing_old_slots(self):
        self.admin();old=self.page.locator('[data-calendar-volunteer]').count();self.set_days([1,6]);self.page.locator('[data-days-generate]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('dias confirmados')")
        self.assertGreater(self.page.locator('[data-calendar-volunteer]').count(),old)
        self.assertTrue(self.page.evaluate("()=>[...document.querySelectorAll('[data-calendar-volunteer]')].some(s=>new Date(s.closest('.monthly-cell').querySelector('[data-day]').dataset.day+'T12:00:00Z').getUTCDay()===1)"))
    def test_g7_departments_independent_and_scoped_not_edit_only(self):
        self.login('multi.teste');self.page.locator('[data-b1-action=department]').filter(has_text='Sonoplastia').click();self.page.wait_for_selector('.department-days');box=self.open_days();self.assertTrue(box.locator('fieldset').first.evaluate('e=>e.disabled'));self.assertEqual(box.locator('button[type=submit]').count(),0)
        denied=self.page.evaluate("async id=>{try{await IASDPISchedules.request('iasdpi_schedule_department_days_save',{p_department:id,p_expected_version:1,p_weekdays:[6],p_request_id:crypto.randomUUID()});return false;}catch{return true;}}",D);self.assertTrue(denied)
    def test_g7_network_failure_retry_selection_and_dirty_guard(self):
        self.admin();box=self.open_days();box.locator('[value="1"]').check();self.page.evaluate("()=>{window.g7Original=IASDPISchedulePreview.request;IASDPISchedulePreview.request=(n,b)=>n==='iasdpi_schedule_department_days_save'?Promise.reject(Error('Falha fictícia temporária')):g7Original(n,b);}")
        box.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('.department-days [role=alert]')?.textContent.includes('seleção foi preservada')");self.assertTrue(self.page.locator('#department-days-form [value="1"]').is_checked());self.assertEqual(self.page.locator('[data-days-status]').inner_text(),'Alterações pendentes.')
        self.page.once('dialog',lambda d:d.dismiss());self.go('schedule-calendar');self.assertTrue(self.page.locator('.department-days').is_visible())
        self.page.evaluate('()=>IASDPISchedulePreview.request=g7Original');self.page.locator('#department-days-form button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-days-status]')?.textContent.includes('Dias salvos')")
    def test_g7_configuration_cas_keeps_local_selection_on_conflict(self):
        self.admin();row=self.page.evaluate("id=>IASDPISchedules.request('iasdpi_schedule_department_days',{p_department:id})",D)
        self.page.evaluate("async({id,v})=>{await IASDPISchedules.request('iasdpi_schedule_department_days_save',{p_department:id,p_expected_version:v,p_weekdays:[6],p_request_id:crypto.randomUUID()});}",{'id':D,'v':row['version']})
        box=self.open_days();box.locator('[value="1"]').check();box.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('.department-days [role=alert]')?.textContent.includes('outro dispositivo')");self.assertTrue(self.page.locator('#department-days-form [value="1"]').is_checked())
    def test_g7_elders_whole_periods_and_five_widths_keyboard(self):
        self.admin();self.page.locator('[data-b1-action=department]').filter(has_text='Ancionato').click();self.page.wait_for_selector('.elder-week-calendar');self.set_days([6]);self.assertEqual(self.page.locator('.elder-week-days').first.locator('.elder-calendar-day').count(),7)
        self.page.locator('[data-elder-action=kind][data-kind=monthly]').click();self.page.wait_for_selector('.elder-year-calendar');self.assertEqual(self.page.locator('.elder-month-card').count(),12)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('#department-days-form [value="1"]').focus();self.page.keyboard.press('Space');self.assertTrue(self.page.locator('#department-days-form [value="1"]').is_checked())
        self.page.once('dialog',lambda d:d.accept());self.page.locator('.monthly-departments [data-department="'+D+'"]').click();self.page.wait_for_selector('.monthly-calendar');self.open_days()
        out=base.ROOT/'dist/governance-g7';out.mkdir(exist_ok=True,parents=True)
        for width,label in [(390,'mobile'),(1440,'desktop')]:self.page.set_viewport_size(dict(width=width,height=900));self.page.screenshot(path=str(out/('g7-'+label+'.png')),full_page=True)
    def test_g7_missing_migration_message_and_remote_readonly_blocks_saving(self):
        self.admin()
        result=self.page.evaluate("""async()=>{
          const previous=window.fetch;window.fetch=async()=>Response.json({code:'PGRST202',message:'missing rpc'},{status:404});let message;
          try{await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_schedule_department_days',{method:'POST',body:'{}'});}catch(e){message=e.message;}finally{window.fetch=previous;}
          window.IASDPIConfig=Object.freeze({...IASDPIConfig,remoteReadOnly:true});
          return {message,read:IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/iasdpi_schedule_department_days','POST'),save:IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/iasdpi_schedule_department_days_save','POST')};
        }""")
        self.assertIn('016',result['message']);self.assertTrue(result['read']);self.assertFalse(result['save'])
