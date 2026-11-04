"""Login unificado, sessão opcional e montagem mensal sem conexão real."""
import unittest
import test_calendar_privacy_browser as privacy
import test_frontend_access as base


class LoginMonthMusicTests(unittest.TestCase):
    setUpClass=classmethod(privacy.CalendarPrivacyBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(privacy.CalendarPrivacyBrowserTests.tearDownClass.__func__)
    setUp=privacy.CalendarPrivacyBrowserTests.setUp
    tearDown=privacy.CalendarPrivacyBrowserTests.tearDown
    go=privacy.CalendarPrivacyBrowserTests.go
    choose=privacy.CalendarPrivacyBrowserTests.choose
    login=privacy.CalendarPrivacyBrowserTests.login

    def department(self,name):
        self.page.locator('.monthly-departments button').get_by_text(name,exact=True).click()
        self.page.wait_for_function('(name)=>document.querySelector("h1")?.textContent===name',arg=name)

    def sign_in(self,remember=True):
        self.choose()
        if not remember:self.page.locator('#portal-login-form [name=remember]').uncheck()
        self.page.fill('#portal-login-form [name=email]','admin.iasdpi')
        self.page.fill('#portal-login-form [name=password]','Demonstracao#2026')
        self.page.locator('#portal-login-form button[type=submit]').click()
        self.page.wait_for_selector('.monthly-calendar')

    def test_church_password_and_remember_in_one_form_default_parada(self):
        self.go('portal-login');self.page.wait_for_selector('#portal-login-form')
        self.page.wait_for_function("()=>document.querySelector('#church-select')?.value==='IASD_PI'")
        self.assertEqual(self.page.locator('#church-select-form').count(),0)
        self.assertEqual(self.page.locator('#portal-login-form #church-select').count(),1)
        self.assertTrue(self.page.locator('#portal-login-form [name=remember]').is_checked())
        fields=self.page.locator('#portal-login-form select,#portal-login-form input').evaluate_all('es=>es.map(e=>e.name)')
        self.assertEqual(fields,['church','email','password','remember'])
        out=base.ROOT/'dist/login-month-music';out.mkdir(parents=True,exist_ok=True)
        for width,label in [(390,'mobile'),(1440,'desktop')]:
            self.page.set_viewport_size({'width':width,'height':950});self.page.screenshot(path=str(out/('login-'+label+'.png')))

    def test_remember_checked_persists_sdk_session_and_logout_clears_it(self):
        self.sign_in()
        self.assertTrue(self.page.evaluate('Boolean(localStorage.getItem(IASDPIStorage.authSession))'))
        self.assertFalse(self.page.evaluate('Boolean(sessionStorage.getItem(IASDPIStorage.authSession))'))
        self.page.reload();self.page.wait_for_selector('.monthly-calendar')
        self.page.locator('#auth-logout').click();self.page.wait_for_function('()=>!IASDPIAuth.identityKey()')
        self.assertFalse(self.page.evaluate('Boolean(localStorage.getItem(IASDPIStorage.authSession)||sessionStorage.getItem(IASDPIStorage.authSession))'))

    def test_remember_unchecked_uses_session_storage_and_new_tab_has_no_saved_login(self):
        self.sign_in(False)
        self.assertFalse(self.page.evaluate('Boolean(localStorage.getItem(IASDPIStorage.authSession))'))
        self.assertTrue(self.page.evaluate('Boolean(sessionStorage.getItem(IASDPIStorage.authSession))'))
        self.page.reload();self.page.wait_for_selector('.monthly-calendar')
        other=self.context.new_page()
        try:
            other.goto(self.url+'#schedule-build');other.wait_for_selector('#portal-login-form')
            self.assertFalse(other.evaluate('Boolean(IASDPIAuth.identityKey())'))
        finally:other.close()

    def test_music_auto_disabled_even_programmatically_and_other_departments_keep_it(self):
        self.sign_in();self.department('Música')
        button=self.page.locator('[data-b1-action=prefill]');self.assertTrue(button.is_disabled())
        button.dispatch_event('click');self.assertEqual(self.page.locator('[data-music-volunteer]:checked').count(),0)
        self.department('Sonoplastia');self.assertTrue(self.page.locator('[data-b1-action=prefill]').is_enabled())

    def test_music_dropdown_multiple_selection_keyboard_five_widths_and_reopen(self):
        self.sign_in();self.department('Música')
        self.assertEqual(self.page.locator('[data-music-volunteer]:visible').count(),0)
        picker=self.page.locator('.music-picker').first;picker.locator('summary').click()
        people=picker.locator('[data-music-volunteer]');selected=[people.nth(i).get_attribute('value') for i in [0,1]]
        for value in selected:self.page.locator('.music-picker').first.locator('[value="'+value+'"]').check()
        self.assertEqual(self.page.locator('.music-picker').first.locator('summary span').first.inner_text(),'2 membros')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':950})
            box=self.page.locator('.music-picker[open] .music-team').bounding_box()
            self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],width)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('.music-picker').first.evaluate('e=>e.open'))
        self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        self.page.locator('[data-b1-action=reload]').click();self.page.wait_for_selector('.music-picker')
        self.assertEqual(set(self.page.locator('.music-picker').first.locator(':checked').evaluate_all('es=>es.map(e=>e.value)')),set(selected))
        self.page.screenshot(path=str(base.ROOT/'dist/login-month-music/musica-recolhida.png'),full_page=True)

    def test_november_manual_start_preserves_future_period_and_historical_sources(self):
        self.page.clock.set_fixed_time('2026-11-04T15:00:00Z');self.page.reload();self.page.wait_for_selector('.church-portal-cards')
        self.sign_in();self.department('Sonoplastia')
        original=self.page.evaluate('JSON.stringify(IASDPIKnownPreviewSeed.rows)')
        self.page.locator('[data-b1-action=month][data-direction="-1"]').click()
        self.page.wait_for_selector('[data-b1-action=start]')
        self.assertEqual(self.page.locator('#schedule-month').input_value(),'2026-11')
        count=self.page.evaluate('IASDPIB1Preview.events.length')
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),0)
        self.assertEqual(count,self.page.evaluate('IASDPIB1Preview.events.length'))
        self.page.locator('[data-b1-action=start]').click();self.page.wait_for_selector('[data-calendar-volunteer]')
        self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),13)
        self.assertTrue(all(d.startswith('2026-11') for d in self.page.locator('[data-calendar-volunteer]').evaluate_all("es=>es.map(e=>e.closest('.monthly-cell').querySelector('[data-day]').dataset.day)")))
        self.assertEqual(self.page.evaluate("async()=>(await IASDPISchedules.request('iasdpi_schedule_settings_get')).future_months"),['2026-12-01','2027-01-01'])
        self.assertEqual(original,self.page.evaluate('JSON.stringify(IASDPIKnownPreviewSeed.rows)'))
        self.page.once('dialog',lambda d:d.accept());self.department('Comunicação')
        self.page.wait_for_selector('[data-calendar-volunteer]');self.assertEqual(self.page.locator('[data-calendar-volunteer]').count(),4)
