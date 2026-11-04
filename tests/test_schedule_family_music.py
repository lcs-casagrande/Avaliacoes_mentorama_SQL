"""Família/Criança reutilizam os cadastros; Música mantém equipe em atribuições normalizadas."""
import shutil
import unittest
from datetime import datetime, timezone
import test_frontend_access as base
import test_schedule_review_ready as review

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class FamilyMusicTests(unittest.TestCase):
    setUpClass=classmethod(review.ReviewBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(review.ReviewBrowserTests.tearDownClass.__func__)
    def setUp(self):
        review.ReviewBrowserTests.setUp(self)
        # Cenários históricos do arquivo usam novembro/2026; não dependem do mês do host.
        self.page.clock.set_fixed_time(datetime(2026,10,30,15,tzinfo=timezone.utc))
        self.page.reload();self.page.wait_for_selector('.simple-daily-calendar')
    tearDown=review.ReviewBrowserTests.tearDown
    catalog=review.ReviewBrowserTests.catalog
    fill=review.ReviewBrowserTests.fill
    save=review.ReviewBrowserTests.save
    def department(self,code):
        d=next(d for d in self.catalog()['departments'] if d['code']==code);self.page.locator('[data-b1-action=department][data-department="'+d['id']+'"]').click();self.page.wait_for_selector('.music-team' if code=='musica' else '.monthly-calendar');return d
    def person(self,name):return next(p['id'] for p in self.catalog()['people'] if p['name']==name)
    def link_music(self,name='Luan'):
        self.page.evaluate("""async name=>{const rpc=IASDPISchedulePreview.request,c=await rpc('iasdpi_schedule_catalog'),p=c.people.find(p=>p.name===name),d=c.departments.find(d=>d.code==='musica'),m=c.memberships.find(m=>m.person_id===p.id&&m.department_id===d.id);if(!m)await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:crypto.randomUUID(),p_expected_version:0,p_request_id:crypto.randomUUID(),p_data:{person_id:p.id,department_id:d.id,active:true}});}""",name)
    def first_team(self):return self.page.locator('.music-team').first
    def flag(self,name):return self.first_team().locator('[data-music-volunteer][value="'+self.person(name)+'"]')
    def publish(self):
        self.page.once('dialog',lambda d:d.accept());self.page.get_by_role('button',name='Publicar escala',exact=True).click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback').textContent.includes('Escala publicada')")
    def test_existing_family_children_records_and_ids_reused_without_new_people(self):
        c=self.catalog();self.assertEqual(len(c['people']),42)
        for code,names in [('ministerio-da-familia',['Luana','Raphael']),('ministerio-da-crianca',['Luciana Abdias'])]:
            d=self.department(code);self.assertTrue(d['active']);self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),4);self.assertCountEqual(self.page.locator('[data-calendar-volunteer]').first.locator('option:not([value=""])').all_text_contents(),names);self.assertEqual(len({p['id'] for p in self.catalog()['people']}),42)
    def test_family_children_and_communication_have_saturday_vacancies_only(self):
        original=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)')
        for code in ['ministerio-da-familia','ministerio-da-crianca','comunicacao']:
            self.department(code);self.assertEqual(self.page.locator('[data-calendar-volunteer]').evaluate_all("els=>els.map(e=>e.closest('.monthly-cell').querySelector('[data-day]').dataset.day)"),['2026-11-07','2026-11-14','2026-11-21','2026-11-28']);self.fill();self.save();self.assertEqual(self.page.locator('.monthly-metrics dd').nth(2).inner_text(),'0')
        self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
    def test_summary_and_feedback_follow_calendar_in_all_daily_departments(self):
        for code in ['sonoplastia','comunicacao','ministerio-da-familia','ministerio-da-crianca','musica']:
            self.department(code);self.assertTrue(self.page.evaluate("()=>{const calendar=document.querySelector('.monthly-calendar'),summary=document.querySelector('.schedule-summary');return Boolean(calendar.compareDocumentPosition(summary)&Node.DOCUMENT_POSITION_FOLLOWING)&&summary.contains(document.querySelector('#b1-feedback'))&&summary.contains(document.querySelector('.monthly-metrics'));}"));self.assertEqual(self.page.locator('#b1-feedback').count(),1)
    def test_music_initially_has_only_confirmed_catalog_member(self):
        self.department('musica');self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),0);self.assertEqual(self.first_team().locator('[data-music-volunteer]').count(),1);self.assertEqual(self.first_team().locator('.checkbox span').inner_text(),'Alexandre');self.assertEqual(self.catalog()['qualifications'],[])
    def test_music_two_people_save_reopen_same_ids_and_uncheck_individually(self):
        self.link_music();d=self.department('musica');self.flag('Alexandre').check();self.flag('Luan').check();self.save();before=self.page.evaluate("d=>IASDPIKnownPreview.plans.get(d+':2026-11-01')",d['id']);row=before['requirements'][0];self.assertEqual(row['required_count'],2);self.assertEqual(len(row['assignments']),2)
        self.page.get_by_role('button',name='Recarregar escala',exact=True).click();self.page.wait_for_selector('.music-team');self.assertTrue(self.flag('Alexandre').is_checked());self.assertTrue(self.flag('Luan').is_checked());self.flag('Luan').uncheck();self.save();after=self.page.evaluate("d=>IASDPIKnownPreview.plans.get(d+':2026-11-01')",d['id']);self.assertEqual(after['id'],before['id']);self.assertEqual(after['requirements'][0]['id'],row['id']);self.assertEqual(after['requirements'][0]['required_count'],1);self.assertEqual(after['requirements'][0]['assignments'][0]['id'],next(a['id'] for a in row['assignments'] if a['person_id']==self.person('Alexandre')))
    def test_music_metrics_match_variable_team_and_no_duplicate_person(self):
        self.link_music();self.department('musica');self.flag('Alexandre').check();self.flag('Luan').check();self.flag('Luan').dispatch_event('change');values=self.page.locator('.monthly-metrics dd').all_text_contents();self.assertEqual(values[:4],['14','2','12','2']);self.save();rows=self.page.evaluate("[...IASDPIKnownPreview.plans.values()].find(p=>p.department_id===IASDPIKnownPreviewSeed.catalog.departments.find(d=>d.code==='musica').id).requirements[0].assignments");self.assertEqual(len(rows),2);self.assertEqual(len({a['person_id'] for a in rows}),2)
    def test_music_cross_department_conflict_is_disabled_and_cannot_be_forced(self):
        self.link_music();self.fill();self.page.locator('[data-calendar-volunteer]').first.select_option(self.person('Luan'));self.publish();self.department('musica');self.assertTrue(self.flag('Luan').is_disabled());self.assertFalse(self.flag('Alexandre').is_disabled());self.flag('Luan').evaluate("e=>{e.disabled=false;e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));}");self.page.wait_for_selector('[role=alert]');self.assertIn('Conflito',self.page.locator('[role=alert]').first.inner_text());self.assertFalse(self.flag('Luan').is_checked())
    def test_music_public_calendar_includes_every_selected_person(self):
        self.link_music();self.department('musica');self.fill();self.flag('Alexandre').check();self.flag('Luan').check();self.publish();rows=self.page.evaluate("IASDPICalendarSource().filter(r=>r.department==='Música'&&r.date==='2026-11-01')");self.assertCountEqual([r['person'] for r in rows],['Alexandre','Luan']);self.assertEqual(len({r['id'] for r in rows}),2)
        self.page.get_by_role('link',name='Ver calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar');self.assertIn('Alexandre',self.page.locator('[data-scale-day="2026-11-01"]').inner_text());self.assertIn('Luan',self.page.locator('[data-scale-day="2026-11-01"]').inner_text());self.assertEqual(self.page.evaluate('IASDPIKnownPreview.legacy.length'),20)
    def test_music_clear_removes_all_people_only_after_confirmation(self):
        self.link_music();self.department('musica');self.flag('Alexandre').check();self.flag('Luan').check();self.page.once('dialog',lambda d:d.accept());self.page.get_by_role('button',name='Limpar escala',exact=True).click();self.assertEqual(self.page.locator('[data-music-volunteer]:checked').count(),0);self.assertEqual(self.page.locator('.music-team').count(),13);self.assertIn('Salve',self.page.locator('#b1-feedback').inner_text())
    def test_music_keyboard_labels_and_responsive_screens(self):
        self.link_music();self.department('musica');field=self.flag('Alexandre');field.focus();self.page.keyboard.press('Space');self.assertTrue(self.flag('Alexandre').is_checked());labels=self.page.locator('[data-music-volunteer]').evaluate_all('els=>els.map(e=>e.getAttribute("aria-label"))');self.assertEqual(len(labels),len(set(labels)))
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size(dict(width=width,height=1000));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.assertGreaterEqual(self.page.locator('.music-team .checkbox').first.bounding_box()['height'],44)
        for width,label in [(1440,'desktop'),(390,'mobile')]:self.page.set_viewport_size(dict(width=width,height=1000));self.page.screenshot(path=str(base.ROOT/f'dist/schedule-family-children-music/music-{label}.png'),full_page=True)
