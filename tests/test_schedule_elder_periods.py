"""Anciãos por períodos e disponibilidade pausada, sem Supabase real."""
from functools import partial
from http.server import ThreadingHTTPServer
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo
import test_schedule_known_people as known

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ElderPeriodsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();demo.builder.build(cls.tmp.name,elder_periods=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    tearDownClass=classmethod(known.KnownPeoplePreviewTests.tearDownClass.__func__)
    setUp=known.KnownPeoplePreviewTests.setUp
    tearDown=known.KnownPeoplePreviewTests.tearDown
    catalog=known.KnownPeoplePreviewTests.catalog
    def elder(self):
        d=next(d for d in self.catalog()['departments'] if d['code']=='ancionato');self.page.locator('[data-b1-action=department][data-department="'+d['id']+'"]').click();self.page.wait_for_selector('[data-elder-person]');return d
    def person(self,name='Adriano Borrego'):return next(p for p in self.catalog()['people'] if p['name']==name)['id']
    def month(self,month):self.page.locator('#elder-month [name=month]').fill(month);self.page.locator('#elder-month button').click();self.page.wait_for_selector('[data-elder-person]')
    def save(self):self.page.locator('[data-elder-action=save]').click();self.page.wait_for_function("document.querySelector('#elder-feedback').textContent.includes('confirmadas')")
    def test_weeks_are_complete_sunday_to_saturday_leap_year_and_month_boundaries(self):
        result=self.page.evaluate("()=>Object.fromEntries(['2026-02','2026-05','2026-11','2026-12','2028-02'].map(m=>[m,IASDPIElderPeriods.periods(m)]))")
        self.assertEqual(len([r for r in result['2026-02'] if r['kind']=='weekly']),4)
        self.assertEqual(len([r for r in result['2026-05'] if r['kind']=='weekly']),6)
        for month,rows in result.items():
            for row in rows:
                if row['kind']=='weekly':
                    import datetime
                    self.assertEqual(datetime.date.fromisoformat(row['starts_on']).weekday(),6);self.assertEqual(datetime.date.fromisoformat(row['ends_on']).weekday(),5);self.assertEqual((datetime.date.fromisoformat(row['ends_on'])-datetime.date.fromisoformat(row['starts_on'])).days,6)
        one=next(r for r in result['2026-11'] if r['starts_on']=='2026-11-29');two=next(r for r in result['2026-12'] if r['starts_on']=='2026-11-29');self.assertEqual(one,two)
        self.assertEqual(result['2028-02'][-1]['ends_on'],'2028-02-29')
    def test_separate_week_and_month_areas_with_ten_existing_elders(self):
        self.elder();self.assertGreater(self.page.locator('[data-elder-person]').count(),1);self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),0);self.assertEqual(self.page.locator('[data-elder-person]').first.locator('option').count(),11)
        self.page.locator('[data-kind=monthly]').click();self.assertEqual(self.page.locator('[data-elder-person]').count(),12);self.assertEqual(self.page.locator('[data-kind=monthly]').get_attribute('aria-pressed'),'true');self.assertIn('Primeiro ao último dia',self.page.locator('.elder-period').first.inner_text())
    def test_boundary_week_saves_one_identity_and_same_person_in_both_months(self):
        self.elder();self.month('2026-11');row=self.page.locator('[data-elder-period="weekly:2026-11-29"]');row.locator('select').select_option(self.person());self.save();identity=self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()][0].id')
        self.month('2026-12');self.assertEqual(self.page.locator('[data-elder-period="weekly:2026-11-29"] select').input_value(),self.person());self.assertEqual(self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()][0].id'),identity);self.assertEqual(self.page.evaluate('IASDPIKnownPreview.elderPeriods.size'),1)
    def test_save_month_does_not_discard_pending_week_or_change_original_agenda(self):
        before=self.page.evaluate('JSON.stringify({official:IASDPICalendarOfficialSource(),legacy:IASDPIKnownPreview.legacy})');self.elder();self.page.locator('[data-elder-person]').first.select_option(self.person('David Cavalcanti'));self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-period="monthly:2026-11-01"] select').select_option(self.person());self.save()
        self.assertEqual(self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()].map(r=>r.kind)'),['monthly'])
        self.page.locator('[data-kind=weekly]').click();self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),self.person('David Cavalcanti'));self.assertIn('Alterações pendentes',self.page.locator('#elder-feedback').inner_text());self.save();self.assertEqual(self.page.evaluate('IASDPIKnownPreview.elderPeriods.size'),2);self.assertEqual(before,self.page.evaluate('JSON.stringify({official:IASDPICalendarOfficialSource(),legacy:IASDPIKnownPreview.legacy})'))
    def test_availability_paused_preserves_rules_on_member_save_and_automatic_ignores_them(self):
        p=next(p for p in self.catalog()['people'] if p['name']=='Luan')
        self.page.evaluate("id=>IASDPIKnownPreviewSeed.catalog.availability.push({id:crypto.randomUUID(),person_id:id,department_id:null,kind:'unavailable',pattern:'weekly',weekdays:[0,1,2,3,4,5,6],active:true,version:1,origin:'daily-profile'})",p['id']);before=self.page.evaluate('JSON.stringify(IASDPIKnownPreviewSeed.catalog.availability)')
        self.page.get_by_role('button',name='Membros',exact=True).click();self.page.wait_for_selector('#availability-paused');self.assertEqual(self.page.locator('[name^=available_],[name^=unavailable_],[name=dates]').count(),0);self.page.locator('#daily-person').select_option(p['id']);self.page.locator('[data-member] [name=max_monthly_count]').fill('20');self.page.locator('[data-member] button[type=submit]').click();self.page.wait_for_function("document.querySelector('main [role=status]').textContent.includes('simulada')");self.assertEqual(before,self.page.evaluate('JSON.stringify(IASDPIKnownPreviewSeed.catalog.availability)'))
        self.page.get_by_role('button',name='Montar escala',exact=True).click();self.page.wait_for_selector('.monthly-calendar');self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')");self.assertIn(p['id'],[f.input_value() for f in self.page.locator('[data-calendar-volunteer]').all()])
    def test_automatic_by_week_and_month_proposes_without_publishing(self):
        self.elder();self.month('2027-02');self.page.locator('[data-elder-action=prefill]').click();self.assertIn('5 períodos sugeridos',self.page.locator('#elder-feedback').inner_text());values=[f.input_value() for f in self.page.locator('[data-elder-person]').all()];self.assertEqual(len(set(values)),5);self.save();self.assertTrue(self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()].every(r=>r.status==="draft")'))
        self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-action=prefill]').click();self.assertTrue(all(field.input_value() for field in self.page.locator('[data-elder-person]').all()));self.assertEqual(self.page.evaluate('IASDPIKnownPreview.elderPeriods.size'),5)
    def test_stale_edit_is_rejected_and_unsaved_fields_are_retained(self):
        d=self.elder();self.month('2027-02');self.page.locator('[data-elder-person]').first.select_option(self.person());self.page.evaluate("async d=>{const w=await IASDPISchedulePreview.request('iasdpi_schedule_elder_workspace',{p_department:d,p_month:'2027-02-01'}),r=w.periods.find(r=>r.kind==='weekly');await IASDPISchedulePreview.request('iasdpi_schedule_elder_save',{p_department:d,p_status:'draft',p_request_id:crypto.randomUUID(),p_rows:[{...r,expected_version:0}]});}",d['id'])
        self.page.locator('[data-elder-action=save]').click();self.page.wait_for_selector('[role=alert]');self.assertIn('mudou',self.page.locator('[role=alert]').inner_text());self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),self.person())
    def test_authorization_publication_coverage_and_atomic_cas_in_demo_adapter(self):
        d=self.elder();self.month('2027-02');result=self.page.evaluate("""async d=>{const rpc=IASDPISchedulePreview.request,w=await rpc('iasdpi_schedule_elder_workspace',{p_department:d,p_month:'2027-02-01'}),r=w.periods[0],p=IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Adriano Borrego');let coverage=false;try{await rpc('iasdpi_schedule_elder_save',{p_department:d,p_status:'published',p_request_id:crypto.randomUUID(),p_rows:[{...r,expected_version:0}]});}catch(e){coverage=e.message.includes('sem ancião');}const request={p_department:d,p_status:'draft',p_rows:[{...r,person_id:p.id,expected_version:0}]};const results=await Promise.allSettled([rpc('iasdpi_schedule_elder_save',{...request,p_request_id:crypto.randomUUID()}),rpc('iasdpi_schedule_elder_save',{...request,p_request_id:crypto.randomUUID()})]);const c=IASDPIKnownPreviewSeed.catalog;c.is_admin=false;c.departments.find(dep=>dep.id===d).can_manage=false;let denied=false;try{await rpc('iasdpi_schedule_elder_save',{...request,p_request_id:crypto.randomUUID()});}catch(e){denied=e.message.includes('Sem gestão');}return {coverage,denied,success:results.filter(r=>r.status==='fulfilled').length};}""",d['id']);self.assertEqual(result,{'coverage':True,'denied':True,'success':1})
    def test_week_conflict_checks_non_service_day_and_preserves_historical_rows(self):
        self.page.evaluate("()=>{const c=IASDPIKnownPreviewSeed.catalog,p=c.people.find(p=>p.name==='Adriano Borrego'),d=c.departments.find(d=>d.code==='sonoplastia'),event={id:crypto.randomUUID(),scheduled_on:'2026-11-02',timing_mode:'day',title:'Teste descartável'};IASDPIKnownPreview.events.push(event);IASDPIKnownPreview.plans.set('conflict-test',{id:crypto.randomUUID(),department_id:d.id,month:'2026-11-01',status:'published',requirements:[{event_id:event.id,assignments:[{person_id:p.id}]}]});}")
        self.elder();self.month('2026-11');option=self.page.locator('[data-elder-period="weekly:2026-11-01"] option[value="'+self.person()+'"]');self.assertTrue(option.evaluate('e=>e.disabled'));self.assertIn('Conflito',option.inner_text());self.assertEqual(self.page.evaluate('IASDPIKnownPreview.legacy.length'),20)
    def test_unsaved_guard_keyboard_labels_and_mobile(self):
        self.elder();fields=self.page.locator('[data-elder-person]');labels=[f.get_attribute('aria-label') for f in fields.all()];self.assertEqual(len(labels),len(set(labels)));fields.first.focus();self.page.keyboard.press('ArrowUp');self.assertTrue(self.page.locator('[data-elder-person]').first.input_value());self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-elder-action=month][data-direction="1"]').click();self.assertEqual(self.page.locator('#elder-month [name=month]').input_value(),'2026-11')
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.set_viewport_size({'width':1440,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-elder-periods/desktop.png'),full_page=True);self.page.set_viewport_size({'width':390,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-elder-periods/mobile.png'),full_page=True)
        self.page.locator('[data-kind=monthly]').click();self.page.screenshot(path=str(base.ROOT/'dist/schedule-elder-periods/month-mobile.png'),full_page=True)
    def test_availability_tab_and_writes_disabled_without_erasing_existing_data(self):
        self.page.get_by_role('button',name='Cadastros',exact=True).click();self.page.wait_for_selector('.schedule-tabs');self.assertEqual(self.page.locator('[data-schedule-action=tab][data-id=availability]').count(),0)
        result=self.page.evaluate("async()=>{try{await IASDPISchedulePreview.request('iasdpi_schedule_save',{p_entity:'availability',p_data:{},p_id:crypto.randomUUID(),p_expected_version:0,p_request_id:crypto.randomUUID()});return false;}catch(e){return e.message.includes('desativada');}}")
        self.assertTrue(result)
    def test_week_and_month_can_publish_independently_with_same_elder(self):
        d=self.elder();self.page.locator('[data-elder-person]').first.select_option(self.person());self.save();self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-action=prefill]').click();self.page.locator('[data-elder-period="monthly:2026-11-01"] select').select_option(self.person());self.page.once('dialog',lambda dialog:dialog.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("document.querySelector('#elder-feedback').textContent.includes('confirmadas')")
        states=self.page.evaluate('Object.fromEntries([...IASDPIKnownPreview.elderPeriods.values()].map(r=>[r.kind,r.status]))');self.assertEqual(states,{'weekly':'draft','monthly':'published'})
