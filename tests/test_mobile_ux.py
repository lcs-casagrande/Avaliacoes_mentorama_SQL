"""Lote 3: geometria, toque e salvamento com dados fictícios e REST interceptado."""
import copy
import shutil
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

import test_frontend_access as base
import test_operational_browser as operational
import test_hour_format as hours


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class MobileUXTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=operational.OperationalBrowserTests.tearDown
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    enter=hours.HourFormatBrowserTests.enter
    save=operational.OperationalBrowserTests.save

    def setUp(self):
        self.hold_save=False;self.held=[]
        factory=self.browser.new_context
        with patch.object(self.browser,'new_context',side_effect=lambda **options:factory(has_touch=True,**options)):
            hours.HourFormatBrowserTests.setUp(self)
        self.before=copy.deepcopy(self.records)
        self.page.set_viewport_size({'width':390,'height':900})

    def supabase(self,route):
        if urlsplit(route.request.url).path=='/rest/v1/rpc/iasdpi_save_program' and self.hold_save:
            self.held.append(route);return
        return operational.OperationalBrowserTests.supabase(self,route)

    def edit(self):
        self.records['clock-fixture']['status']='Em andamento';self.enter()
        self.page.evaluate('navigate("actuals","clock-fixture")')

    def release(self):
        self.hold_save=False
        for route in self.held:operational.OperationalBrowserTests.supabase(self,route)
        self.held.clear();self.page.wait_for_function('()=>!state.busy')

    def assertFits(self):
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),self.page.evaluate('innerWidth'))

    def assertFieldVisible(self,selector):
        self.page.wait_for_function('''selector=>{const e=document.querySelector(selector).getBoundingClientRect(),b=document.querySelector('.registration-savebar,.execution-actions .big').getBoundingClientRect();return e.top>=-1&&e.bottom<=b.top-8;}''',arg=selector)

    def fakeKeyboard(self):
        self.page.add_init_script('''window.mobileViewport=new EventTarget();Object.assign(mobileViewport,{height:900,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:mobileViewport});''')

    def test_admin_all_pages_and_long_text_fit_five_viewports(self):
        self.enter();source=copy.deepcopy(self.records['clock-fixture'])
        source['plan']['name']='Culto da comunidade — '+('NomeSemSeparadores'*9)
        source['plan']['items'][0]['activity']='Atividade — '+('TextoExtensoSemSeparadores'*7)
        source['actual_details'][self.parent]['note']='Observação '+('NotaExtensaSemSeparadores'*40)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            for view in ['home','organization','programs','actuals','plan-edit','tracking','summary','history','users','archive','trash','agendas']:
                with self.subTest(width=width,view=view):
                    self.page.evaluate('''({source,view})=>{const p=structuredClone(source);state.programs=[p];state.selected=p.id;if(view==='tracking'){p.status='Em andamento';p.execution_mode='live';p.executions[p.plan.items[0].id].ended=null;}usersState.loaded=true;usersState.rows=[{user_id:IASDPIAuth.session().user.id,email:'usuario.'+'extenso'.repeat(20)+'@example.invalid',role:'admin',enabled:true}];state.page=view;render();}''',{'source':source,'view':view})
                    self.assertFits()
        self.assertEqual(self.records,self.before)

    def test_public_and_leader_navigation_fit_all_viewports(self):
        self.enter();self.role='leader';self.page.evaluate('async()=>await IASDPIAuth.requireAccess()')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.page.evaluate('navigate("programs")');self.assertFits()
            self.assertFalse(self.page.locator('nav [data-page="users"]').is_visible())
        self.page.evaluate('async()=>await IASDPIAuth.logout()')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.page.evaluate('navigate("organization")');self.assertFits()
            self.assertFalse(self.page.locator('nav [data-page="history"]').is_visible())

    def test_savebar_remains_visible_in_middle_at_all_widths(self):
        self.edit()
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.page.locator('.actual-row').nth(7).scroll_into_view_if_needed()
            box=self.page.locator('.registration-savebar').bounding_box()
            self.assertGreater(box['y'],0);self.assertLessEqual(box['y']+box['height'],901)
            self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],width)
            self.assertTrue(self.page.locator('.registration-savebar [name="save"]').is_visible())
            self.assertEqual(self.page.locator('.registration-savebar [name="finalize"]').count(),0)

    def test_touch_save_updates_same_record_without_finalizing(self):
        self.edit();before=copy.deepcopy(self.records['clock-fixture'])
        self.page.locator('.actual-row').nth(7).locator('[name="activity-note"]').fill('Salvo no celular')
        self.page.locator('.registration-savebar [name="save"]').tap();self.page.wait_for_function('()=>!state.busy')
        saved=self.records['clock-fixture'];self.assertEqual(saved['status'],'Em andamento');self.assertEqual(saved['version'],2)
        self.assertEqual(saved['id'],before['id']);self.assertEqual(saved['executions'],before['executions'])
        self.assertEqual(len(self.records),1);self.assertEqual(self.page.evaluate('state.page'),'actuals')
        self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'saved')
        self.assertIn('confirmadas',self.page.locator('#registration-save-status').inner_text())

    def test_pending_and_saving_wait_for_server_confirmation(self):
        self.edit();self.hold_save=True
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Pendente')
        self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'dirty')
        self.page.locator('.registration-savebar [name="save"]').tap()
        self.page.wait_for_function('()=>state.busy&&document.querySelector(".registration-savebar").dataset.state==="saving"')
        self.assertIn('Salvando',self.page.locator('#registration-save-status').inner_text())
        self.assertTrue(self.page.locator('.registration-savebar [name="save"]').is_disabled())
        self.assertEqual(self.records['clock-fixture']['version'],1)
        self.release();self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'saved')
        self.assertEqual(self.records['clock-fixture']['version'],2)

    def test_write_error_preserves_inputs_and_retry_succeeds(self):
        self.edit();self.fail_write=True
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Preservar no erro')
        self.save();self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'error')
        self.assertIn('Não foi possível salvar',self.page.locator('#registration-save-status').inner_text())
        self.assertEqual(self.page.locator('#registration-save-status').get_attribute('aria-live'),'assertive')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'Preservar no erro')
        self.assertEqual(self.records['clock-fixture']['version'],1)
        self.fail_write=False;self.save();self.assertEqual(self.records['clock-fixture']['version'],2)
        self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'saved')
        self.assertEqual(len(self.records),1)

    def test_partial_save_stays_partial_and_enter_never_finalizes(self):
        self.edit();self.records['clock-fixture']['executions']={};self.records['clock-fixture']['actual_details']={}
        self.page.once('dialog',lambda d:d.accept());self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.page.locator('[name="record-name"]').fill('Registro parcial')
        self.page.locator('[name="record-name"]').press('Enter');self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['status'],'Planejamento');self.assertEqual(self.records['clock-fixture']['executions'],{});self.assertEqual(self.records['clock-fixture']['version'],2)
        self.assertEqual(self.page.evaluate('state.page'),'actuals')

    def test_error_is_near_field_visible_and_announced_in_bar(self):
        self.edit();field=self.page.locator('.actual-row').last.locator('[name="start"]');field.fill('09:??:00')
        self.save();self.page.wait_for_selector('[aria-invalid="true"]')
        self.assertFieldVisible('.actual-row:last-child [name="start"]')
        self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'error')
        self.assertTrue(field.evaluate('(e)=>document.activeElement===e'))
        self.assertTrue(field.evaluate('(e)=>Boolean(document.getElementById(e.getAttribute("aria-describedby")))'))
        self.assertEqual(self.records['clock-fixture']['version'],1)

    def test_finalization_remains_separate_and_available_above_bar(self):
        self.edit();button=self.page.locator('#actuals-form [name="finalize"]');button.scroll_into_view_if_needed()
        box=button.bounding_box();bar=self.page.locator('.registration-savebar').bounding_box()
        self.assertLessEqual(box['y']+box['height'],bar['y'])
        button.tap();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.records['clock-fixture']['status'],'Finalizada');self.assertEqual(self.page.evaluate('state.page'),'summary')
        self.assertEqual(self.page.locator('.registration-savebar').count(),0)

    def test_invalid_finalization_does_not_save_or_hide_the_field(self):
        self.edit();self.page.locator('.actual-row').last.locator('[name="end"]').fill('')
        self.page.locator('[name="finalize"]').tap();self.page.wait_for_function('()=>!state.busy')
        self.assertFieldVisible('.actual-row:last-child [name="end"]')
        self.assertEqual(self.page.locator('.registration-savebar').get_attribute('data-state'),'error')
        self.assertEqual(self.records['clock-fixture']['version'],1)

    def test_virtual_viewport_resize_keeps_input_and_save_above_keyboard(self):
        self.fakeKeyboard();self.edit()
        selector='.actual-row:last-child [name="end"]';self.page.locator(selector).focus()
        self.page.evaluate('mobileViewport.height=500;mobileViewport.dispatchEvent(new Event("resize"))')
        self.page.wait_for_function('()=>Math.abs(document.querySelector(".registration-savebar").getBoundingClientRect().bottom-500)<2')
        self.assertFieldVisible(selector);self.assertFits()
        self.page.evaluate('mobileViewport.height=900;mobileViewport.dispatchEvent(new Event("resize"))')
        self.page.wait_for_function('()=>getComputedStyle(document.documentElement).getPropertyValue("--registration-viewport-inset")==="0px"')

    def test_virtual_viewport_scroll_and_zoom_do_not_misplace_bar(self):
        self.fakeKeyboard();self.edit()
        self.page.evaluate('mobileViewport.height=500;mobileViewport.offsetTop=100;mobileViewport.dispatchEvent(new Event("scroll"))')
        self.page.wait_for_function('()=>Math.abs(document.querySelector(".registration-savebar").getBoundingClientRect().bottom-600)<2')
        self.page.evaluate('mobileViewport.scale=2;mobileViewport.dispatchEvent(new Event("resize"))')
        self.page.wait_for_function('()=>getComputedStyle(document.documentElement).getPropertyValue("--registration-viewport-inset")==="0px"')

    def test_recovered_draft_bar_shows_pending_not_saved(self):
        self.edit();self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Rascunho mobile')
        self.page.evaluate('async()=>await IASDPIDrafts.flush()');self.page.once('dialog',lambda d:d.accept());self.page.reload()
        self.page.wait_for_selector('[data-draft-restore]');self.page.locator('[data-draft-restore]').click()
        self.page.wait_for_function('()=>!state.busy&&document.querySelector(".registration-savebar").dataset.state==="dirty"')
        self.assertIn('não salvo',self.page.locator('#registration-save-status').inner_text())
        self.assertEqual(self.records['clock-fixture']['version'],1)

    def test_scrollable_tables_are_local_focusable_regions(self):
        self.enter();self.page.evaluate('navigate("summary","clock-fixture")');self.assertFits()
        tables=self.page.locator('.table-scroll[tabindex="0"]');self.assertGreater(tables.count(),0)
        wrapper=tables.first;self.assertEqual(wrapper.get_attribute('role'),'region')
        self.assertIn('Rolagem horizontal',wrapper.get_attribute('aria-label'))
        wrapper.focus();self.page.keyboard.press('ArrowRight')
        self.page.wait_for_function('()=>document.activeElement.scrollLeft>0');self.assertEqual(self.page.evaluate('scrollX'),0)

    def test_form_touch_targets_and_font_sizes(self):
        self.edit()
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            values=self.page.locator('#actuals-form button').evaluate_all('(buttons)=>buttons.map(b=>b.getBoundingClientRect().height)')
            self.assertTrue(all(height>=44 for height in values))
            if width<=390:
                sizes=self.page.locator('#actuals-form input,#actuals-form select,#actuals-form textarea').evaluate_all('(inputs)=>inputs.map(e=>parseFloat(getComputedStyle(e).fontSize))')
                self.assertTrue(all(size>=16 for size in sizes))

    def test_keyboard_focus_and_last_notes_are_not_covered(self):
        self.edit();selector='#actuals-form [name="record-info"]';self.page.locator(selector).focus();self.assertFieldVisible(selector)
        self.page.locator('[name="save"]').focus();self.page.keyboard.press('Tab');self.page.keyboard.press('Shift+Tab');self.assertTrue(self.page.locator('[name="save"]').evaluate('(e)=>e.matches(":focus-visible")'))
        self.assertEqual(self.page.locator('[name="save"]').evaluate('(e)=>getComputedStyle(e).outlineStyle'),'solid')

    def test_savebar_disappears_and_layout_resets_on_other_pages(self):
        self.edit();self.page.evaluate('navigate("organization")');self.assertEqual(self.page.locator('.registration-savebar').count(),0)
        self.assertEqual(self.page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--registration-bar-height")'),'')
        self.assertFits()

    def test_tracking_controls_and_notes_above_simulated_keyboard(self):
        self.fakeKeyboard();self.enter()
        self.page.evaluate('''()=>{const p=state.programs[0];p.status='Em andamento';p.execution_mode='live';p.executions[p.plan.items[0].id].ended=null;navigate('tracking',p.id);}''')
        selector='#notes-form [name="incident"]';self.page.locator(selector).focus()
        self.page.evaluate('mobileViewport.height=500;mobileViewport.dispatchEvent(new Event("resize"))')
        self.page.wait_for_function('()=>document.querySelector(".execution-actions .big").getBoundingClientRect().bottom<501')
        self.assertFieldVisible(selector);self.assertFits()

    def test_confirmation_does_not_claim_cloud_in_local_preview_mode(self):
        self.edit()
        self.page.evaluate('''()=>{window.IASDPIOperational=null;window.IASDPIDemo=IASDPILocalAdapter;localStorage.setItem(IASDPIStorage.programs,JSON.stringify(state.programs));}''')
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('Somente navegador')
        self.save()
        self.assertIn('neste navegador',self.page.locator('#registration-save-status').inner_text())
        self.assertNotIn('confirmadas e salvas no Supabase',self.page.locator('#registration-save-status').inner_text())

    def test_invalid_record_date_error_is_attached_to_date_field(self):
        self.edit();field=self.page.locator('[name="record-date"]');field.fill('31/02/2026');self.save()
        self.assertEqual(field.get_attribute('aria-invalid'),'true');self.assertFieldVisible('[name="record-date"]')
        self.assertIn('data válida',field.locator('..').inner_text());self.assertEqual(self.records['clock-fixture']['version'],1)

    def test_required_subactivity_title_error_is_attached_to_title(self):
        self.edit();field=self.page.locator('.subactivity [name="sub-title"]').first;field.fill('');self.save()
        self.assertEqual(field.get_attribute('aria-invalid'),'true');self.assertFieldVisible('.subactivity [name="sub-title"]')
        self.assertIn('título',field.locator('..').inner_text());self.assertEqual(self.records['clock-fixture']['version'],1)

    def test_planning_invalid_date_is_attached_to_input_without_saving(self):
        self.records['clock-fixture']['status']='Planejamento';before=copy.deepcopy(self.records)
        self.enter();self.page.evaluate('navigate("plan-edit","clock-fixture")')
        field=self.page.locator('#program-form [name="date"]');field.fill('31/02/2026')
        self.page.locator('#program-form button[type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(field.get_attribute('aria-invalid'),'true');self.assertIn('data válida',field.locator('..').inner_text())
        self.assertEqual(self.records,before)

    def test_duplicate_modal_date_errors_and_corrected_submit_still_work(self):
        for obj in [self.records['clock-fixture']['plan'],*self.records['clock-fixture']['plan']['items']]:
            obj['start']=obj['start'][:5];obj['end']=obj['end'][:5]
        self.enter();self.page.evaluate('navigate("programs")');self.page.locator('[data-action="duplicate"]').first.click()
        field=self.page.locator('#duplicate-form [name="date"]');field.fill('31/02/2026')
        self.page.locator('#duplicate-form button[type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(field.get_attribute('aria-invalid'),'true');self.assertEqual(len(self.records),1)
        field.fill('17/10/2026');self.page.locator('#duplicate-form button[type="submit"]').click()
        self.page.wait_for_function('()=>!state.busy');self.assertEqual(len(self.records),2)
        self.assertFalse(self.page.locator('#duplicate-dialog').evaluate('(e)=>e.open'))
