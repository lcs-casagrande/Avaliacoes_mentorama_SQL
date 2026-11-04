"""Portal reorganizado: interações reais em Chromium, Auth e persistência simulados."""
from pathlib import Path
import re
import unittest
import test_calendar_privacy_browser as privacy
import test_frontend_access as base


class PortalUXBrowserTests(unittest.TestCase):
    setUpClass=classmethod(privacy.CalendarPrivacyBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(privacy.CalendarPrivacyBrowserTests.tearDownClass.__func__)
    setUp=privacy.CalendarPrivacyBrowserTests.setUp
    tearDown=privacy.CalendarPrivacyBrowserTests.tearDown
    go=privacy.CalendarPrivacyBrowserTests.go
    choose=privacy.CalendarPrivacyBrowserTests.choose
    login=privacy.CalendarPrivacyBrowserTests.login

    def header(self, route):
        if not self.page.locator('.portal-primary-links').is_visible():
            self.page.locator('.portal-menu-toggle').click()
        link=self.page.locator('.portal-header [data-page="'+route+'"]')
        if link.evaluate('e=>Boolean(e.closest(".portal-admin-links"))') and not link.is_visible():
            self.page.locator('.portal-admin-menu>summary').click()
        link.click()

    def crono(self):
        self.header('home');self.page.wait_for_selector('#auth-login-form')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.page.fill('#auth-login-form [name=email]','admin.iasdpi');self.page.fill('#auth-login-form [name=password]','Demonstracao#2026')
        self.page.locator('#auth-login-form button[type=submit]').click()
        self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!bootInProgress')
        self.page.wait_for_selector('.portal-context-nav')

    def test_public_four_links_one_calendar_and_no_administrative_tools(self):
        self.assertEqual(self.page.locator('.portal-primary-links a:visible').all_text_contents(), ['Início','Calendário','Organograma','Entrar'])
        self.assertFalse(self.page.locator('.portal-admin-menu').is_visible())
        self.assertEqual(self.page.locator('.church-portal-cards [data-page=schedule-build]').count(), 0)
        self.header('schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('.header a[aria-current=page]').inner_text(), 'Calendário')
        self.header('organization');self.page.wait_for_selector('#organization-results')
        self.header('portal-login');self.page.wait_for_selector('#church-select')
        self.assertEqual(self.page.locator('#event-editor,[data-calendar-volunteer],#registry-person').count(), 0)

    def test_admin_primary_modules_grouped_tools_and_discrete_account(self):
        self.login()
        self.assertEqual(self.page.locator('.portal-primary-links a:visible').all_text_contents(), ['Início','Calendário','Escalas','Eventos','Organograma','Cronoanálise'])
        self.assertTrue(self.page.locator('.portal-admin-menu').is_visible())
        self.assertEqual(self.page.locator('[data-account-label]').inner_text(),'Administrador')
        self.assertTrue(self.page.locator('#auth-logout').is_visible())
        self.assertLess(self.page.locator('.portal-header').bounding_box()['height'], 115)
        for route,selector in [('schedule-members','#registry-people-results'),('schedule-setup','.schedule-tabs'),('schedule-settings','#daily-settings'),('access-admin','.governance-tabs')]:
            self.header(route);self.page.wait_for_selector(selector)
            self.assertEqual(self.page.locator('.portal-admin-menu>summary').get_attribute('aria-current'),'page')
        self.assertEqual(self.page.locator('.schedule-tabs').count(),0)

    def test_five_modules_keep_crono_authorization_and_contextual_links(self):
        self.login()
        for route,selector in [('schedule-calendar','.scale-calendar'),('schedule-build','.monthly-calendar'),('events','[data-event-new]'),('organization','#organization-results')]:
            self.header(route);self.page.wait_for_selector(selector)
        self.crono()
        for route in ['programs','history','home']:
            self.page.locator('.portal-context-nav [data-portal-route='+route+']').click()
            self.page.wait_for_function('(route)=>state.page===route',arg=route)
            self.assertEqual(self.page.locator('.portal-context-nav [aria-current=page]').get_attribute('data-portal-route'),route)
        self.assertFalse(self.page.locator('.portal-primary-links [data-page=programs]').count())

    def test_all_administration_links_preserve_distinct_record_tools(self):
        self.login();self.crono()
        # Lista vazia fictícia: valida navegação, não o RPC real da Lixeira.
        self.page.evaluate('trashState.rows=[]')
        for route,title in [('models','Modelos de liturgia'),('history','Histórico'),('archive','Arquivo e banco'),('trash','Lixeira de cultos')]:
            self.header(route)
            self.page.wait_for_function('(route)=>state.page===route',arg=route)
            self.assertIn(title,self.page.locator('#app h1').inner_text())
        self.header('access-request');self.page.wait_for_function("()=>state.page==='access-request'")
        self.assertGreater(self.page.locator('#app form').count(),0)

    def test_single_department_selector_preserves_choice_and_pending_changes(self):
        self.login()
        self.page.locator('.monthly-departments [data-department="00000000-0000-4000-8000-000000000001"]').click()
        self.page.wait_for_selector('[data-calendar-volunteer]')
        self.assertEqual(self.page.locator('.monthly-departments').count(),1)
        self.assertEqual(self.page.locator('[data-portal-department]').count(),0)
        select=self.page.locator('[data-calendar-volunteer]').first
        select.select_option(select.locator('option:not([value=""]):not([disabled])').first.get_attribute('value'))
        self.page.once('dialog',lambda d:d.dismiss());self.header('organization')
        self.assertEqual(self.page.evaluate('state.page'),'schedule-build')
        self.page.locator('[data-b1-action=save]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        self.header('organization');self.page.wait_for_selector('#organization-results');self.header('schedule-build')
        self.page.wait_for_selector('[data-calendar-volunteer]')
        self.assertEqual(self.page.locator('.monthly-departments [aria-pressed=true]').inner_text(),'Sonoplastia')
        self.assertTrue(self.page.locator('[data-calendar-volunteer]').first.input_value())

    def test_old_agenda_route_reload_back_forward_and_all_internal_targets(self):
        self.header('schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.header('organization');self.page.wait_for_selector('#organization-results')
        self.page.go_back();self.page.wait_for_selector('.scale-calendar')
        self.page.go_forward();self.page.wait_for_selector('#organization-results')
        self.page.goto(self.url+'#agendas');self.page.wait_for_selector('.scale-calendar');self.page.reload();self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('.header a[aria-current=page]').inner_text(),'Calendário')
        self.login()
        routes=set(re.findall("'([^']+)'",(base.ROOT/'frontend/navigation.js').read_text().split('const pages=new Set([',1)[1].split(']);',1)[0]))
        links=self.page.locator('.portal-header a[href^="#"]').evaluate_all('es=>es.map(e=>e.hash.slice(1))')
        self.assertTrue(set(links)<=routes,set(links)-routes)

    def test_mobile_menu_keyboard_escape_five_widths_and_screenshots(self):
        out=base.ROOT/'dist/portal-ux';out.mkdir(parents=True,exist_ok=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        for width,label in [(1440,'desktop'),(390,'mobile')]:
            self.page.set_viewport_size({'width':width,'height':1000});self.page.screenshot(path=str(out/('public-'+label+'.png')))
        self.page.locator('.portal-menu-toggle').focus();self.page.keyboard.press('Enter')
        self.assertEqual(self.page.locator('.portal-menu-toggle').get_attribute('aria-expanded'),'true')
        self.page.keyboard.press('Escape');self.assertEqual(self.page.locator('.portal-menu-toggle').get_attribute('aria-expanded'),'false')
        self.assertTrue(self.page.locator('.portal-menu-toggle').evaluate('e=>e===document.activeElement'))
        self.page.set_viewport_size({'width':1440,'height':1000});self.login()
        self.page.locator('.monthly-departments [data-department="00000000-0000-4000-8000-000000000001"]').click();self.page.wait_for_selector('[data-calendar-volunteer]')
        self.page.locator('.portal-admin-menu>summary').focus();self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('.portal-admin-menu').evaluate('e=>e.open'))
        self.page.keyboard.press('Tab');self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('.portal-admin-menu').evaluate('e=>e.open'))
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        for width,label in [(1440,'desktop'),(390,'mobile')]:
            self.page.set_viewport_size({'width':width,'height':1000});self.page.screenshot(path=str(out/('admin-'+label+'.png')))
        self.header('organization');self.page.wait_for_selector('#organization-results')
        self.assertEqual(self.page.locator('.portal-menu-toggle').get_attribute('aria-expanded'),'false')

    def test_logout_removes_admin_navigation_and_public_drafts_remain_absent(self):
        self.login();self.header('schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.page.locator('#auth-logout').click()
        self.page.wait_for_function('()=>!IASDPIAuth.identityKey()')
        self.assertFalse(self.page.locator('.portal-admin-menu').is_visible())
        self.assertEqual(self.page.locator('.portal-primary-links a:visible').all_text_contents(),['Início','Calendário','Organograma','Entrar'])
        self.header('schedule-calendar');self.page.wait_for_selector('.scale-calendar')
        self.assertEqual(self.page.locator('.scale-chip').count(),0)
