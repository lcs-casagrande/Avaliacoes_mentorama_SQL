"""Seleção de mês em português, imediata e sem perda de alterações pendentes."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_review_ready as review

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class MonthPickerTests(unittest.TestCase):
    setUpClass=classmethod(review.ReviewBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(review.ReviewBrowserTests.tearDownClass.__func__)
    setUp=review.ReviewBrowserTests.setUp
    tearDown=review.ReviewBrowserTests.tearDown
    catalog=review.ReviewBrowserTests.catalog
    department=review.ReviewBrowserTests.department
    def pick(self,month,scope='#b1-scope'):
        host=self.page.locator(scope+' [data-month-picker]');host.locator('[data-month-open]').click()
        current=int(host.locator('[data-picker-year-label]').inner_text());year=int(month[:4])
        for _ in range(abs(current-year)):host.locator('[data-month-year="'+('1' if year>current else '-1')+'"]').click()
        host.locator('[data-month-option="'+month[5:]+'"]').click()
    def wait_month(self,value,scope='#b1-scope'):
        self.page.wait_for_function("({scope,value})=>document.querySelector(scope+' [name=month]')?.value===value",arg=dict(scope=scope,value=value));self.page.wait_for_selector(scope+' [data-month-open]')
    def test_portuguese_grid_and_no_confirmation_button(self):
        self.assertEqual(self.page.get_by_role('button',name='Abrir mês',exact=True).count(),0);self.assertEqual(self.page.locator('input[type=month]').count(),0)
        host=self.page.locator('#b1-scope [data-month-picker]');self.assertEqual(host.locator('[data-month-label]').inner_text(),'Novembro de 2026');host.locator('[data-month-open]').click()
        self.assertEqual(host.locator('[data-month-option]').all_text_contents(),['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']);self.assertEqual(host.locator('[data-month-option][aria-pressed=true]').inner_text(),'Novembro')
    def test_selection_loads_immediately_and_restores_focus(self):
        self.pick('2026-12');self.wait_month('2026-12');self.assertIn('Dezembro',self.page.locator('.monthly-calendar h2').inner_text());self.assertTrue(self.page.locator('#b1-scope [data-month-open]').evaluate('e=>e===document.activeElement'));self.assertEqual(self.page.locator('[role=dialog]:visible').count(),0)
    def test_unsaved_cancel_restores_month_label_and_assignments(self):
        field=self.page.locator('[data-calendar-volunteer]').first;person=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(person)
        self.page.once('dialog',lambda d:d.dismiss());self.pick('2026-12');self.wait_month('2026-11');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),person);self.assertEqual(self.page.locator('#b1-scope [data-month-label]').inner_text(),'Novembro de 2026');self.assertIn('Alterações pendentes',self.page.locator('#b1-feedback').inner_text())
    def test_unsaved_accept_switches_without_saving_or_mutating_history(self):
        original=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)');field=self.page.locator('[data-calendar-volunteer]').first;field.select_option(field.locator('option:not([value=""])').first.get_attribute('value'))
        self.page.once('dialog',lambda d:d.accept());self.pick('2026-12');self.wait_month('2026-12');self.pick('2026-11');self.wait_month('2026-11');self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),'');self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
    def test_same_month_does_not_prompt_or_discard_edits(self):
        field=self.page.locator('[data-calendar-volunteer]').first;person=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(person);dialogs=[];self.page.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()));self.pick('2026-11');self.assertEqual(dialogs,[]);self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),person)
    def test_weekly_picker_and_annual_year_apply_without_confirmation(self):
        self.department('ancionato');self.pick('2026-12','#elder-month');self.wait_month('2026-12','#elder-month');self.assertEqual(self.page.locator('.elder-calendar-day:not(.is-outside)').count(),31)
        self.page.locator('[data-kind=monthly]').click();self.assertEqual(self.page.get_by_role('button',name='Abrir ano',exact=True).count(),0);self.page.locator('#elder-year select').select_option('2028');self.page.wait_for_selector('[data-elder-period="monthly:2028-02-01"]');self.assertIn('29/02/2028',self.page.locator('[data-elder-period="monthly:2028-02-01"] [role=tooltip]').inner_text());self.assertEqual(self.page.locator('.elder-month-card').count(),12)
        person=next(p['id'] for p in self.catalog()['people'] if p['name']=='David Cavalcanti');self.page.locator('[data-elder-person]').first.select_option(person);self.page.once('dialog',lambda d:d.dismiss());self.page.locator('#elder-year select').select_option('2029');self.assertEqual(self.page.locator('#elder-year select').input_value(),'2028');self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),person)
    def test_calendar_consultation_uses_same_portuguese_picker(self):
        self.page.get_by_role('button',name='Calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar');self.pick('2027-01','.scale-month-actions');self.page.wait_for_function("document.querySelector('#scale-month')?.value==='2027-01'");self.assertEqual(self.page.locator('.scale-month-actions [data-month-label]').inner_text(),'Janeiro de 2027')
    def test_keyboard_navigation_escape_and_outside_click(self):
        host=self.page.locator('#b1-scope [data-month-picker]');trigger=host.locator('[data-month-open]');trigger.focus();self.page.keyboard.press('Enter');self.assertTrue(host.locator('[data-month-option="11"]').evaluate('e=>e===document.activeElement'));self.page.keyboard.press('ArrowRight');self.page.keyboard.press('Enter');self.wait_month('2026-12')
        host=self.page.locator('#b1-scope [data-month-picker]');host.locator('[data-month-open]').click();self.page.keyboard.press('Escape');self.assertFalse(host.locator('[role=dialog]').is_visible());self.assertTrue(host.locator('[data-month-open]').evaluate('e=>e===document.activeElement'))
        host.locator('[data-month-open]').click();self.page.locator('h1').click();self.assertFalse(host.locator('[role=dialog]').is_visible())
    def test_weekly_unsaved_cancel_restores_picker_and_pending_person(self):
        self.department('ancionato');person=next(p['id'] for p in self.catalog()['people'] if p['name']=='David Cavalcanti');self.page.locator('[data-elder-person]').first.select_option(person);self.page.once('dialog',lambda d:d.dismiss());self.pick('2026-12','#elder-month');self.wait_month('2026-11','#elder-month');self.assertEqual(self.page.locator('[data-elder-person]').first.input_value(),person)
    def test_popup_touch_targets_and_five_viewport_bounds(self):
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=1000));host=self.page.locator('#b1-scope [data-month-picker]');host.locator('[data-month-open]').click();bounds=host.locator('[role=dialog]').bounding_box();self.assertGreaterEqual(bounds['x'],0);self.assertLessEqual(bounds['x']+bounds['width'],width);self.assertGreaterEqual(host.locator('[data-month-option]').first.bounding_box()['height'],44);self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.page.keyboard.press('Escape')
        for width,label in [(1440,'desktop'),(390,'mobile')]:
            self.page.set_viewport_size(dict(width=width,height=1000));self.page.locator('#b1-scope [data-month-open]').click();self.page.screenshot(path=str(base.ROOT/f'dist/schedule-month-picker/{label}.png'));self.page.keyboard.press('Escape')
        self.page.get_by_role('button',name='Calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=1000));host=self.page.locator('.scale-month-actions [data-month-picker]');host.locator('[data-month-open]').click();bounds=host.locator('[role=dialog]').bounding_box();self.assertGreaterEqual(bounds['x'],0);self.assertLessEqual(bounds['x']+bounds['width'],width);self.assertTrue(host.locator('[data-month-option]').evaluate_all('els=>els.every(e=>e.scrollWidth<=e.clientWidth)'));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.page.keyboard.press('Escape')
