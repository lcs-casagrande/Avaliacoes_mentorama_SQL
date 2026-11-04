"""Topo compacto: identidade, menu secundário, navegação e proteção das edições."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_review_ready as review

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class CompactHeaderTests(unittest.TestCase):
    setUpClass=classmethod(review.ReviewBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(review.ReviewBrowserTests.tearDownClass.__func__)
    setUp=review.ReviewBrowserTests.setUp
    tearDown=review.ReviewBrowserTests.tearDown
    def more(self):return self.page.get_by_text('⋯',exact=True)
    def test_compact_height_identity_touch_targets_and_five_viewports(self):
        self.assertEqual(self.page.locator('.schedule-brand-copy strong').inner_text(),'IASDPI');self.assertIn('Parada Inglesa',self.page.locator('.schedule-brand-copy small').inner_text())
        self.assertEqual(self.page.locator('.schedule-primary-nav>button').all_text_contents(),['Montar escala','Calendário','Membros'])
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=1000));self.assertLessEqual(self.page.locator('header').bounding_box()['height'],116 if width<601 else 80);self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            for button in self.page.locator('.schedule-primary-nav>button,header summary,header .scale-help-button').all():self.assertGreaterEqual(button.bounding_box()['height'],44)
        for width,label in [(1440,'desktop'),(390,'mobile')]:
            self.page.set_viewport_size(dict(width=width,height=1000));self.page.screenshot(path=str(base.ROOT/f'dist/schedule-header/{label}.png'))
    def test_secondary_items_remain_available_and_mark_active_section(self):
        self.assertFalse(self.page.get_by_role('button',name='Cadastros',exact=True).is_visible());self.more().click();self.page.get_by_role('button',name='Cadastros',exact=True).click();self.page.wait_for_selector('.schedule-tabs');self.assertFalse(self.page.locator('.schedule-nav-more').evaluate('e=>e.open'));self.assertEqual(self.page.locator('header summary').get_attribute('aria-current'),'page')
        self.more().click();self.page.get_by_role('button',name='Configurações',exact=True).click();self.page.wait_for_selector('#daily-settings');self.assertEqual(self.page.locator('header [data-demo-view=schedule-settings]').get_attribute('aria-current'),'page')
        self.page.get_by_role('button',name='Montar escala',exact=True).first.click();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('.schedule-primary-nav>[data-demo-view=schedule-build]').get_attribute('aria-current'),'page')
    def test_pending_edits_still_require_confirmation_through_more_menu(self):
        field=self.page.locator('[data-calendar-volunteer]').first;person=field.locator('option:not([value=""])').first.get_attribute('value');field.select_option(person);self.more().click();self.page.once('dialog',lambda d:d.dismiss());self.page.get_by_role('button',name='Cadastros',exact=True).click()
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').first.input_value(),person);self.assertEqual(self.page.locator('.schedule-primary-nav>[data-demo-view=schedule-build]').get_attribute('aria-current'),'page');self.assertTrue(self.page.locator('.schedule-nav-more').evaluate('e=>e.open'))
    def test_browser_back_and_forward_update_active_navigation(self):
        self.page.get_by_role('button',name='Calendário',exact=True).click();self.page.wait_for_selector('.scale-calendar');self.assertEqual(self.page.locator('header [data-demo-view=schedule-calendar]').get_attribute('aria-current'),'page')
        self.page.go_back();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('.schedule-primary-nav>[data-demo-view=schedule-build]').get_attribute('aria-current'),'page')
        self.page.go_forward();self.page.wait_for_selector('.scale-calendar');self.assertEqual(self.page.locator('header [data-demo-view=schedule-calendar]').get_attribute('aria-current'),'page')
    def test_menu_keyboard_escape_outside_click_and_mobile_bounds(self):
        self.page.set_viewport_size(dict(width=360,height=1000));summary=self.page.locator('header summary');summary.focus();self.page.keyboard.press('Enter');self.assertTrue(self.page.get_by_role('button',name='Cadastros',exact=True).is_visible());self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('.schedule-nav-more').evaluate('e=>e.open'));self.assertTrue(summary.evaluate('e=>e===document.activeElement'))
        summary.click();bounds=self.page.locator('.schedule-more-items').bounding_box();self.assertGreaterEqual(bounds['x'],0);self.assertLessEqual(bounds['x']+bounds['width'],360);self.page.screenshot(path=str(base.ROOT/'dist/schedule-header/mobile-menu.png'));self.page.locator('h1').click(position={'x':5,'y':5});self.assertFalse(self.page.locator('.schedule-nav-more').evaluate('e=>e.open'))
