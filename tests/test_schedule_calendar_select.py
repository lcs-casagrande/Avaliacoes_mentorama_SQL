"""Seletores no calendário: mesmo rascunho/validação dos detalhes, sem Supabase real."""
import unittest
import shutil
import test_frontend_access as base
import test_schedule_known_people as known

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class CalendarSelectTests(unittest.TestCase):
    setUpClass=classmethod(known.ConfirmationScenarioTests.setUpClass.__func__)
    tearDownClass=classmethod(known.ConfirmationScenarioTests.tearDownClass.__func__)
    setUp=known.ConfirmationScenarioTests.setUp
    tearDown=known.ConfirmationScenarioTests.tearDown
    def test_change_and_clear_inside_date_updates_details_and_counts(self):
        first=self.page.locator('[data-calendar-volunteer]').first;value=first.locator('option:not([value=""])').first.get_attribute('value');first.select_option(value)
        self.assertEqual(self.page.locator('.b1-requirement select').first.input_value(),value);self.assertEqual(self.page.locator('.monthly-metrics dd').nth(1).inner_text(),'1');self.assertIn('Alterações pendentes',self.page.locator('#b1-feedback').inner_text())
        self.assertTrue(self.page.evaluate('document.activeElement.hasAttribute("data-calendar-volunteer")'))
        self.page.locator('[data-calendar-volunteer]').first.select_option('');self.assertEqual(self.page.locator('.monthly-metrics dd').nth(1).inner_text(),'0');self.assertEqual(self.page.locator('.b1-requirement select').first.input_value(),'')
    def test_detail_change_updates_calendar_and_saved_same_assignment_reopens(self):
        self.page.locator('.monthly-day.has-events').first.click();field=self.page.locator('.b1-requirement select').first;value=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(value);self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),value)
        self.assertTrue(self.page.evaluate('document.activeElement.closest("#monthly-day-details")!==null'))
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("document.querySelector('#b1-feedback').textContent.includes('confirmadas')");before=self.page.evaluate('[...IASDPIKnownPreview.plans.values()][0].requirements[0].assignments[0].id')
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('[data-calendar-volunteer]');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),value);self.assertEqual(before,self.page.evaluate('[...IASDPIKnownPreview.plans.values()][0].requirements[0].assignments[0].id'))
    def test_blocked_choices_disabled_before_selection(self):
        self.page.evaluate("IASDPIKnownPreviewSeed.catalog.availability.forEach(v=>v.active=false)");self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('[data-calendar-volunteer]');options=self.page.locator('[data-calendar-volunteer]').first.locator('option:not([value=""])')
        self.assertTrue(all(option.evaluate('(el)=>el.disabled') for option in options.all()));self.assertIn('⚠ Indisponível',options.first.inner_text());self.assertNotIn('Pendente de confirmação',options.first.inner_text());self.page.locator('[data-calendar-volunteer]').first.focus();self.page.keyboard.press('ArrowDown');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),'')
    def test_keyboard_labels_valid_html_and_mobile_no_horizontal_overflow(self):
        self.assertEqual(self.page.locator('button select').count(),0)
        fields=self.page.locator('[data-calendar-volunteer]');labels=[f.get_attribute('aria-label') for f in fields.all()];self.assertEqual(len(labels),len(set(labels)));self.assertTrue(all('Calendário' in label and 'Sonoplastia' in label for label in labels))
        fields.first.focus();self.page.keyboard.press('ArrowDown');self.assertNotEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),'')
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.assertGreaterEqual(self.page.locator('[data-calendar-volunteer]').first.bounding_box()['height'],44)
    def test_reader_view_has_no_assignment_selects(self):
        self.page.evaluate("(()=>{const original=IASDPISchedulePreview.request;IASDPISchedulePreview.request=async(name,args)=>{const row=await original(name,args);if(name==='iasdpi_schedule_catalog'){row.is_admin=false;row.departments.forEach(d=>d.can_manage=false);}return row;};})()")
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),0);self.assertEqual(self.page.locator('[data-b1-action=save]').count(),0)
