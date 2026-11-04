"""G8.2: portal real em Chromium com provedor exclusivamente simulado."""
from pathlib import Path
import subprocess,unittest
import test_department_days_browser as g7
import test_portal_integration_browser as g4
import test_frontend_access as base
D=g7.D;M=g7.M
class RegistryIntegrationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        g4.PortalIntegrationBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--registry-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(g4.PortalIntegrationBrowserTests.tearDownClass.__func__)
    setUp=g4.PortalIntegrationBrowserTests.setUp
    tearDown=g4.PortalIntegrationBrowserTests.tearDown
    go=g4.PortalIntegrationBrowserTests.go
    choose=g4.PortalIntegrationBrowserTests.choose
    login=g4.PortalIntegrationBrowserTests.login
    admin=g7.DepartmentDaysBrowserTests.admin
    prefill=g4.PortalIntegrationBrowserTests.prefill
    def registry(self):self.go('schedule-members');self.page.wait_for_selector('#registry-department')
    def catalog(self):return self.page.evaluate("IASDPISchedules.request('iasdpi_registry_catalog')")
    def person(self,name='Luan'):return next(p for p in self.catalog()['people'] if p['name']==name)
    def row(self,p):
        c=self.catalog();m=next(m for m in c['memberships'] if m['person_id']==p['id'] and m['department_id']==D);return self.page.locator('[data-registry-member="'+m['id']+'"]')
    def confirm_row(self,row):
        row.locator('[name=participation_confirmed]').check();row.locator('[name=role_ids]').first.check()
        for i in range(7):row.locator('[name=day_'+str(i)+']').select_option('available')
        self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
    def test_unknown_is_excluded_then_explicit_confirmation_enables_rotation(self):
        self.admin();self.prefill();self.assertEqual(self.page.locator('[data-calendar-volunteer]').evaluate_all('es=>es.filter(e=>e.value).length'),0)
        self.registry();self.page.select_option('#registry-department',D);p=self.person();self.confirm_row(self.row(p));self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.prefill();self.assertGreater(self.page.locator('[data-calendar-volunteer]').evaluate_all('es=>es.filter(e=>e.value).length'),0)
    def test_add_same_person_to_three_departments_no_duplicate_and_independent_changes(self):
        self.admin();self.registry();p=self.person();c=self.catalog();deps=[d for d in c['departments'] if d['code'] in ['sonoplastia','musica','comunicacao']];before=len(c['people'])
        self.page.locator('summary').filter(has_text='Vincular pessoa').click();f=self.page.locator('#registry-add-links');f.locator('[name=person]').select_option(p['id'])
        for d in deps:f.locator('[name=departments][value="'+d['id']+'"]').check()
        self.page.once('dialog',lambda d:d.accept());f.locator('button[type=submit],button:not([type])').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        c=self.catalog();self.assertEqual(len(c['people']),before);self.assertTrue(all(any(m['person_id']==p['id'] and m['department_id']==d['id'] for m in c['memberships']) for d in deps))
        self.page.select_option('#registry-department',D);row=self.row(p);row.locator('[name=max_monthly_count]').fill('4');self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        c=self.catalog();self.assertEqual(next(m for m in c['memberships'] if m['person_id']==p['id'] and m['department_id']==D)['max_monthly_count'],4);self.assertIsNone(next(m for m in c['memberships'] if m['person_id']==p['id'] and m['department_id']==M).get('max_monthly_count'))
    def test_leader_only_own_department_and_no_person_rename(self):
        self.login('som.teste');self.registry();self.assertEqual(self.page.locator('#registry-department option').count(),1);self.assertEqual(self.page.locator('#registry-person').count(),0);self.assertEqual(self.page.locator('#registry-associate').count(),0)
        denied=self.page.evaluate("async id=>{try{await IASDPISchedules.request('iasdpi_registry_save',{p_person:id,p_expected_person_version:1,p_person_patch:{name:'Indevido'},p_links:[],p_request_id:crypto.randomUUID()});return false;}catch{return true;}}",self.person()['id']);self.assertTrue(denied)
    def test_head_not_automatically_volunteer_and_organogram_updates_after_rename(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person('Mini Lucas');row=self.row(p);row.locator('[name=is_ministry_head]').check();self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')");self.assertFalse(self.row(p).locator('[name=participation_confirmed]').is_checked());self.assertEqual(self.row(p).locator('[name=role_ids]:checked').count(),0)
        self.page.locator('summary').filter(has_text='Cadastrar ou atualizar').click();f=self.page.locator('#registry-person');f.locator('[name=person]').select_option(p['id']);f.locator('[name=name]').fill('Luan atualizado');f.locator('[name=display_name]').fill('Luan atualizado');self.page.once('dialog',lambda d:d.accept());f.locator('button[type=submit],button:not([type])').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        self.go('organization');self.page.wait_for_function("()=>document.querySelector('[data-ministry=Sonoplastia]')?.textContent.includes('Luan atualizado')")
    def test_unsaved_guard_and_failure_preserve_link_changes(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person();row=self.row(p);row.locator('[name=max_monthly_count]').fill('6');self.page.once('dialog',lambda d:d.dismiss());self.go('schedule-calendar');self.assertTrue(self.page.locator('#registry-department').is_visible())
        self.page.evaluate("()=>{window.oldRegistry=IASDPISchedulePreview.request;IASDPISchedulePreview.request=(n,b)=>n==='iasdpi_registry_save'?Promise.reject(Error('Falha fictícia')):oldRegistry(n,b);}");self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('#app [role=alert]')?.textContent.includes('preservadas')");self.assertEqual(self.row(p).locator('[name=max_monthly_count]').input_value(),'6')
    def test_historical_names_preserved_until_association_and_mobile(self):
        self.admin();self.registry();self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20);self.assertGreater(self.page.locator('#registry-associate [name=source] option').count(),20)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.assertLess(self.page.locator('[data-registry-member]').first.bounding_box()['height'],300)
        out=base.ROOT/'dist/registry-g82'
        for width,label in [(390,'mobile'),(1440,'desktop')]:self.page.set_viewport_size(dict(width=width,height=900));self.page.screenshot(path=str(out/('registry-'+label+'.png')),full_page=True)
    def test_rotation_checks_other_departments_before_selecting_person(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person();self.confirm_row(self.row(p))
        self.page.evaluate("""async id=>{const c=await IASDPISchedules.request('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.code==='musica'),r=c.roles.find(r=>r.department_id===d.id&&r.general_assignment);await IASDPISchedules.request('iasdpi_registry_save',{p_person:id,p_expected_person_version:c.people.find(p=>p.id===id).version,p_person_patch:{},p_links:[{department_id:d.id,expected_version:0,patch:{participation_confirmed:true,role_ids:[r.id],weekdays:Object.fromEntries(Array.from({length:7},(_,i)=>[i,'available']))}}],p_request_id:crypto.randomUUID()});}""",p['id'])
        self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.page.locator('[data-b1-action=department]').filter(has_text='Música').click();self.page.wait_for_selector('.music-team');self.prefill();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').first.click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        self.page.locator('.monthly-departments [data-department="'+D+'"]').click();self.page.wait_for_selector('[data-calendar-volunteer]');self.prefill();self.assertFalse(self.page.locator('[data-calendar-volunteer]').evaluate_all('(es,id)=>es.some(e=>e.value===id)',p['id']))
    def test_confirmed_qualification_with_unknown_availability_still_not_suggested(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person();row=self.row(p);row.locator('[name=participation_confirmed]').check();row.locator('[name=role_ids]').first.check();self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        self.go('schedule-build');self.page.wait_for_selector('[data-calendar-volunteer]');self.prefill();self.assertFalse(self.page.locator('[data-calendar-volunteer]').evaluate_all('(es,id)=>es.some(e=>e.value===id)',p['id']))
    def test_explicit_source_association_updates_view_but_preserves_original(self):
        self.admin();self.registry();p=self.person();key='legacy:Sonoplastia:2026-10-03:Mini Lucas';original=self.page.evaluate('ministrySchedules.Sonoplastia[0].person')
        self.page.locator('summary').filter(has_text='Associações pendentes').click();f=self.page.locator('#registry-associate');f.locator('[name=source]').select_option(key);f.locator('[name=person]').select_option(p['id']);self.page.once('dialog',lambda d:d.accept());f.locator('button[type=submit],button:not([type])').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('Associação confirmada')")
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.wait_for_function("()=>IASDPIScheduleCalendar.legacy().some(r=>r.id==='legacy:Sonoplastia:2026-10-03:Mini Lucas'&&r.person==='Luan')");self.assertEqual(self.page.evaluate('ministrySchedules.Sonoplastia[0].person'),original);self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
    def test_removing_registered_head_does_not_restore_outdated_static_responsible(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person();row=self.row(p);self.assertTrue(row.locator('[name=is_ministry_head]').is_checked());row.locator('[name=is_ministry_head]').uncheck();self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        self.go('organization');self.page.wait_for_function("()=>document.querySelector('[data-ministry=Sonoplastia]')?.textContent.includes('Não informado')")
        self.assertEqual(self.page.evaluate("churchMinistries.find(d=>d.name==='Sonoplastia').responsibles"),['Luan'])
    def test_new_person_draft_and_id_survive_connection_failure(self):
        self.admin();self.registry();count=len(self.catalog()['people']);self.page.locator('summary').filter(has_text='Cadastrar ou atualizar').click();f=self.page.locator('#registry-person');f.locator('[name=name]').fill('Pessoa fictícia nova G82')
        self.page.evaluate("()=>{window.oldRegistry=IASDPISchedulePreview.request;IASDPISchedulePreview.request=(n,b)=>n==='iasdpi_registry_save'?Promise.reject(Error('Falha fictícia')):oldRegistry(n,b);}");self.page.once('dialog',lambda d:d.accept());f.locator('button[type=submit],button:not([type])').click();self.page.wait_for_function("()=>document.querySelector('#app [role=alert]')?.textContent.includes('preservadas')");self.assertEqual(f.locator('[name=name]').input_value(),'Pessoa fictícia nova G82')
        self.page.evaluate('()=>IASDPISchedulePreview.request=oldRegistry');self.page.once('dialog',lambda d:d.accept());f.locator('button[type=submit],button:not([type])').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')");self.assertEqual(len(self.catalog()['people']),count+1)
