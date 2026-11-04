"""Fluxo integrado montar/publicar/consultar no adaptador isolado da prévia."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_elder_periods as elders

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class SchedulePublishFlowTests(unittest.TestCase):
    setUpClass=classmethod(elders.ElderPeriodsTests.setUpClass.__func__)
    tearDownClass=classmethod(elders.ElderPeriodsTests.tearDownClass.__func__)
    setUp=elders.ElderPeriodsTests.setUp
    tearDown=elders.ElderPeriodsTests.tearDown
    catalog=elders.ElderPeriodsTests.catalog
    elder=elders.ElderPeriodsTests.elder
    person=elders.ElderPeriodsTests.person
    def fill(self):
        self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Proposta editável')")
    def save(self):
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')")
    def publish(self):
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('Escala publicada')")
    def local_rows(self):return self.page.evaluate("IASDPIScheduleCalendar.data().filter(r=>r.id.startsWith('local:'))")
    def test_clean_editor_distribution_table_and_one_publish_action(self):
        body=self.page.locator('main').inner_text()
        for text in ['Participante do departamento','Participação no departamento','Preparar eventos']:self.assertNotIn(text,body)
        self.assertEqual(self.page.locator('#b1-extra,#b1-recurring,[data-b1-action=layout]').count(),0)
        self.assertEqual(self.page.get_by_role('button',name='Publicar escala',exact=True).count(),1)
        self.fill();self.assertEqual(self.page.locator('.schedule-distribution tbody tr').count(),7)
        total=sum(int(value) for value in self.page.locator('.schedule-distribution tbody td:nth-child(2)').all_text_contents())
        self.assertEqual(total,int(self.page.locator('.monthly-metrics dd').nth(1).inner_text()))
    def test_draft_hidden_publish_daily_visible_on_correct_month_and_department(self):
        self.fill();self.save();self.assertEqual(self.local_rows(),[])
        first=self.page.locator('[data-calendar-volunteer]').first.input_value();person=next(p for p in self.catalog()['people'] if p['id']==first)
        self.publish();self.page.get_by_role('link',name='Ver no calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('#scale-month').input_value(),'2026-11');self.assertIn('Sonoplastia',self.page.locator('[data-scale-action=department][aria-pressed=true]').inner_text())
        rows=self.local_rows();self.assertGreater(len(rows),0);self.assertEqual(next(r for r in rows if r['date']=='2026-11-01')['person'],person['display_name'])
        visible=self.page.evaluate("IASDPIScheduleCalendar.data().filter(r=>r.department==='Sonoplastia'&&r.date==='2026-11-01')");self.assertEqual(len(visible),1)
        self.assertEqual(self.page.evaluate('IASDPIKnownPreview.legacy.length'),20)
    def test_failed_publication_keeps_draft_and_shows_error_near_actions(self):
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_selector('[role=alert]')
        self.assertEqual(self.local_rows(),[]);self.assertIn('vagas',self.page.locator('.schedule-publishbar').inner_text().lower())
        self.assertGreater(self.page.locator('[data-calendar-volunteer]').count(),0)
    def test_new_draft_preserves_last_publication_until_republish(self):
        self.fill();self.publish();before=self.local_rows();field=self.page.locator('[data-calendar-volunteer]').first;old=field.input_value();other=next(p for p in self.catalog()['people'] if p['id']!=old and any(m['person_id']==p['id'] and m['department_id']==self.catalog()['departments'][0]['id'] for m in self.catalog()['memberships']))
        field.select_option(other['id']);self.page.once('dialog',lambda d:d.accept());self.save();self.assertEqual(self.local_rows(),before)
        self.publish();self.assertEqual(next(r for r in self.local_rows() if r['date']=='2026-11-01')['person'],other['display_name'])
    def test_week_and_month_publish_project_to_calendar_without_mutating_official_source(self):
        original=self.page.evaluate('JSON.stringify(IASDPICalendarOfficialSource())');self.elder();self.page.locator('[data-elder-person]').first.select_option(self.person('David Cavalcanti'))
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("document.querySelector('#elder-feedback').textContent.includes('Escala publicada')")
        self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-action=prefill]').click();self.page.locator('[data-elder-period="monthly:2026-11-01"] select').select_option(self.person());self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("document.querySelector('#elder-feedback').textContent.includes('Escala publicada')")
        self.page.get_by_role('link',name='Ver no calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar')
        rows=self.page.evaluate('IASDPIScheduleCalendar.periods()');week=[r for r in rows if r['kind']=='weekly' and r['startDate']=='2026-11-01'];month=[r for r in rows if r['kind']=='monthly' and r['startDate']=='2026-11-01']
        self.assertEqual(len(week),1);self.assertEqual(week[0]['person'],'David Cavalcanti');self.assertTrue(week[0]['id'].startswith('managed:'))
        self.assertEqual(len(month),1);self.assertEqual(month[0]['person'],'Adriano Borrego');self.assertIn('Adriano Borrego',self.page.locator('.scale-month-responsibles').inner_text())
        self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPICalendarOfficialSource())'))
    def test_draft_period_does_not_remove_last_published_period(self):
        d=self.elder();result=self.page.evaluate("""async d=>{const rpc=IASDPISchedulePreview.request,w=await rpc('iasdpi_schedule_elder_workspace',{p_department:d,p_month:'2026-11-01'}),r=w.periods.find(r=>r.kind==='monthly'),c=await rpc('iasdpi_schedule_catalog'),a=c.people.find(p=>p.name==='Adriano Borrego'),b=c.people.find(p=>p.name==='David Cavalcanti');let saved=await rpc('iasdpi_schedule_elder_save',{p_department:d,p_status:'published',p_rows:[{...r,person_id:a.id,expected_version:r.version}],p_request_id:crypto.randomUUID()});await rpc('iasdpi_schedule_elder_save',{p_department:d,p_status:'draft',p_rows:[{...saved.periods[0],person_id:b.id,expected_version:saved.periods[0].version}],p_request_id:crypto.randomUUID()});return IASDPIScheduleCalendar.periods().filter(r=>r.kind==='monthly'&&r.startDate==='2026-11-01');}""",d['id'])
        self.assertEqual(len(result),1);self.assertEqual(result[0]['person'],'Adriano Borrego')
    def test_actions_visible_mobile_table_scroll_and_keyboard_publish_access(self):
        self.fill()
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.page.locator('.schedule-distribution').scroll_into_view_if_needed();self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            bounds=self.page.locator('[data-b1-action=publish]').bounding_box();self.assertGreaterEqual(bounds['height'],44);self.assertLessEqual(bounds['y']+bounds['height'],1001)
        self.page.locator('[data-b1-action=publish]').focus();self.assertTrue(self.page.locator('[data-b1-action=publish]').evaluate('(el)=>el===document.activeElement'))
        self.page.set_viewport_size({'width':1440,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-final-flow/desktop.png'),full_page=True);self.page.set_viewport_size({'width':390,'height':1000});self.page.screenshot(path=str(base.ROOT/'dist/schedule-final-flow/mobile.png'),full_page=True);self.page.screenshot(path=str(base.ROOT/'dist/schedule-final-flow/mobile-viewport.png'))
