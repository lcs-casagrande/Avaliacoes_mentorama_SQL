"""Calendário de anciãos, Comunicação aos sábados e departamento inativo na prévia."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_elder_periods as elders

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Chromium')
class CalendarAdjustmentsTests(unittest.TestCase):
    setUpClass=classmethod(elders.ElderPeriodsTests.setUpClass.__func__)
    tearDownClass=classmethod(elders.ElderPeriodsTests.tearDownClass.__func__)
    setUp=elders.ElderPeriodsTests.setUp
    tearDown=elders.ElderPeriodsTests.tearDown
    catalog=elders.ElderPeriodsTests.catalog
    elder=elders.ElderPeriodsTests.elder
    person=elders.ElderPeriodsTests.person
    month=elders.ElderPeriodsTests.month
    save=elders.ElderPeriodsTests.save
    def communication(self):
        d=next(d for d in self.catalog()['departments'] if d['code']=='comunicacao')
        self.page.locator('[data-b1-action=department][data-department="'+d['id']+'"]').click()
        self.page.wait_for_selector('[data-calendar-volunteer]')
        return d
    def test_child_department_active_preserves_person_membership_and_reuses_management(self):
        c=self.catalog();d=next(d for d in c['departments'] if d['code']=='ministerio-da-crianca')
        self.assertTrue(d['active']);self.assertEqual(len(c['people']),42)
        self.assertTrue(any(m['department_id']==d['id'] for m in c['memberships']))
        self.assertEqual(self.page.locator('[data-b1-action=department][data-department="'+d['id']+'"]').count(),1)
        self.assertEqual(self.page.evaluate("async d=>(await IASDPISchedulePreview.request('iasdpi_schedule_workspace',{p_department:d,p_month:'2026-11-01'})).plan.requirements.length",d['id']),4)
    def test_communication_only_saturday_slots_automatic_save_reload_and_original_history(self):
        original=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)');self.communication()
        expected=['2026-11-07','2026-11-14','2026-11-21','2026-11-28']
        self.assertEqual(self.page.locator('.monthly-metrics dd').first.inner_text(),'4')
        dates=self.page.locator('[data-calendar-volunteer]').evaluate_all("els=>els.map(e=>e.closest('.monthly-cell').querySelector('[data-day]').dataset.day)")
        self.assertEqual(dates,expected)
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')")
        self.assertTrue(all(field.input_value() for field in self.page.locator('[data-calendar-volunteer]').all()))
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('[data-calendar-volunteer]')
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),4)
        self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
    def test_existing_non_saturday_communication_assignment_is_never_deleted(self):
        d=self.communication();expected=self.page.evaluate("""d=>{const plan=IASDPIKnownPreview.plans.get(d+':2026-11-01'),event=IASDPIKnownPreview.events.find(e=>e.scheduled_on==='2026-11-04'),person=IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Henrique'),r={...structuredClone(plan.requirements[0]),id:crypto.randomUUID(),event_id:event.id,notes:'Apontamento anterior preservado',assignments:[{id:crypto.randomUUID(),person_id:person.id,timing_mode:'day',starts_at:null,ends_at:null}]};plan.requirements.push(r);return r;}""",d['id'])
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_function("document.querySelectorAll('[data-calendar-volunteer]').length===5")
        self.assertEqual(self.page.locator('[data-day="2026-11-04"]').locator('..').locator('select').input_value(),expected['assignments'][0]['person_id'])
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
        self.assertEqual(self.page.evaluate("d=>IASDPIKnownPreview.plans.get(d+':2026-11-01').requirements.find(r=>r.event_id===IASDPIKnownPreview.events.find(e=>e.scheduled_on==='2026-11-04').id)",d['id']),expected)
    def test_week_calendar_has_every_day_and_exactly_one_selector_per_sunday_saturday_row(self):
        self.elder();self.month('2026-05')
        self.assertEqual(self.page.locator('.elder-week-row').count(),6)
        self.assertEqual(self.page.locator('.elder-calendar-day:not(.is-outside)').count(),31)
        dates=self.page.locator('.elder-calendar-day:not(.is-outside) time').evaluate_all('els=>els.map(e=>e.dateTime)')
        self.assertEqual(len(set(dates)),31)
        for row in self.page.locator('.elder-week-row').all():
            self.assertEqual(row.locator('.elder-calendar-day').count(),7);self.assertEqual(row.locator('select').count(),1)
            day=row.locator('.elder-calendar-day').first.bounding_box();field=row.locator('select').bounding_box();self.assertLess(day['y'],field['y'])
    def test_annual_calendar_has_twelve_unique_months_leap_year_and_navigation(self):
        self.elder();self.page.locator('[data-kind=monthly]').click();self.page.wait_for_selector('#elder-year')
        self.assertEqual(self.page.locator('.elder-month-card').count(),12)
        self.assertEqual(self.page.locator('.elder-month-card h3').all_text_contents(),['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])
        labels=self.page.locator('[data-elder-person]').evaluate_all('els=>els.map(e=>e.getAttribute("aria-label"))');self.assertEqual(len(set(labels)),12)
        self.page.locator('#elder-year [name=year]').fill('2028');self.page.locator('#elder-year button').click();self.page.wait_for_selector('[data-elder-period="monthly:2028-02-01"]')
        self.assertIn('29/02/2028',self.page.locator('[data-elder-period="monthly:2028-02-01"]').inner_text())
        self.page.locator('[data-elder-action=year][data-direction="1"]').click();self.page.wait_for_selector('[data-elder-period="monthly:2029-01-01"]')
        self.assertEqual(self.page.locator('#elder-year [name=year]').input_value(),'2029')
    def test_annual_partial_draft_save_preserves_ids_weekly_pending_and_official_source(self):
        original=self.page.evaluate('JSON.stringify(IASDPICalendarOfficialSource())');self.elder()
        self.page.locator('[data-elder-person]').first.select_option(self.person('David Cavalcanti'))
        self.page.locator('[data-kind=monthly]').click()
        for date,name in [('2026-01-01','Adriano Borrego'),('2026-02-01','David Cavalcanti')]:self.page.locator('[data-elder-period="monthly:'+date+'"] select').select_option(self.person(name))
        self.save();saved=self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()]')
        self.assertEqual(len(saved),2);self.assertTrue(all(r['kind']=='monthly' for r in saved))
        self.page.locator('[data-kind=weekly]').click();self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),self.person('David Cavalcanti'));self.save()
        self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-action=reload]').click();self.page.wait_for_selector('.elder-year-calendar')
        self.assertEqual(self.page.locator('[data-elder-period="monthly:2026-01-01"] select').input_value(),self.person())
        self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPICalendarOfficialSource())'))
        self.assertEqual({r['id'] for r in saved},{r['id'] for r in self.page.evaluate('[...IASDPIKnownPreview.elderPeriods.values()].filter(r=>r.kind==="monthly")')})
    def test_twelve_month_transaction_and_stale_batch_rejection(self):
        d=self.elder();result=self.page.evaluate("""async d=>{const rpc=IASDPISchedulePreview.request,w=await rpc('iasdpi_schedule_elder_workspace',{p_department:d,p_month:'2027-11-01',p_year:2027}),person=IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Adriano Borrego'),rows=w.periods.filter(r=>r.kind==='monthly').map(r=>({...r,person_id:person.id,expected_version:r.version})),args={p_department:d,p_rows:rows,p_status:'draft',p_request_id:crypto.randomUUID()},first=await rpc('iasdpi_schedule_elder_save',args),retry=await rpc('iasdpi_schedule_elder_save',args);let stale=false;try{await rpc('iasdpi_schedule_elder_save',{...args,p_request_id:crypto.randomUUID()});}catch(e){stale=e.message.includes('mudou');}return {count:first.periods.length,identical:JSON.stringify(first)===JSON.stringify(retry),stale,versions:[...IASDPIKnownPreview.elderPeriods.values()].map(r=>r.version)};}""",d['id'])
        self.assertEqual(result,dict(count=12,identical=True,stale=True,versions=[1]*12))
    def test_weekly_and_annual_mobile_keyboard_and_no_horizontal_overflow(self):
        self.elder();self.month('2027-01')
        for view in ['weekly','monthly']:
            self.page.locator('[data-kind='+view+']').click()
            for width in [360,390,768,1024,1440]:
                self.page.set_viewport_size(dict(width=width,height=1000));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.assertGreaterEqual(self.page.locator('[data-elder-person]').first.bounding_box()['height'],44)
            for width,label in [(1440,'desktop'),(390,'mobile')]:
                self.page.set_viewport_size(dict(width=width,height=1000));self.page.screenshot(path=str(base.ROOT/f'dist/schedule-calendar-adjustments/{view}-{label}.png'),full_page=True)
        field=self.page.locator('[data-elder-person]').first;field.focus();self.page.keyboard.press('ArrowDown');self.assertTrue(self.page.locator('[data-elder-person]').first.input_value())
        self.assertEqual(self.page.locator('button select').count(),0)
