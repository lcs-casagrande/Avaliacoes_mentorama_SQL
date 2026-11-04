"""Filtros contextuais no HTML real, sem Supabase ou alterações em registros reais."""
from pathlib import Path
import unittest
import test_events_browser as events
import test_frontend_access as base

class CalendarRefineTests(unittest.TestCase):
    setUpClass=classmethod(events.EventBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(events.EventBrowserTests.tearDownClass.__func__)
    setUp=events.EventBrowserTests.setUp
    tearDown=events.EventBrowserTests.tearDown
    calendar=events.EventBrowserTests.calendar
    go=events.EventBrowserTests.go
    def start(self,mode='all'):
        self.calendar();self.page.locator('[data-calendar-mode='+mode+']').click()
    def panel(self):
        if self.page.locator('#calendar-filters-toggle').get_attribute('aria-expanded')=='false':self.page.locator('#calendar-filters-toggle').click()
    def dropdown(self,key):
        self.panel();el=self.page.locator('[data-refine-list='+key+']')
        if not el.evaluate('e=>e.open'):el.locator('summary').click()
        return el
    def mark(self,key,name,checked=True):
        self.dropdown(key).get_by_label(name,exact=True).set_checked(checked)
    def published_fixture(self):
        # Fotografias fictícias em memória para testar categorias; não importa ou altera fontes reais.
        self.page.evaluate("""async()=>{const som=IASDPIKnownPreviewSeed.catalog.departments.find(d=>d.name==='Sonoplastia').id;for(const [id,title,program_category,department_id] of [['filtro-geral','Evento geral fictício','general',null],['filtro-som','Evento de som fictício','departmental',som],['filtro-reservado','Atividade reservada fictícia','reserved',null],['filtro-pendente','Evento pendente fictício',null,null]]){const e={id,title,program_category,category:department_id?'department':'church',department_id,date:'2026-10-12',end_date:'2026-10-12',status:'published',version:1,all_day:false,start_time:null,end_time:null,location:'',description:'',source_key:null};IASDPIE1Demo.versions.set(id,[{status:'published',snapshot:e,version:1}]);}await IASDPIEvents.refreshFeed('2026-10');}""")
    def test_initial_toolbar_and_only_contextual_fields(self):
        self.start();self.assertEqual(self.page.locator('[data-calendar-mode]').all_text_contents(),['Tudo','Escalas','Eventos'])
        self.assertFalse(self.page.locator('#calendar-refine-panel').is_visible());self.assertEqual(self.page.locator('#scale-person,.scale-filter-bar,.event-categories').count(),0)
        self.panel();self.assertEqual(self.page.locator('[data-refine-list]').count(),1)
        self.page.locator('[data-calendar-mode=scales]').click();self.assertEqual(self.page.locator('[data-refine-list]').count(),2);self.assertEqual(self.page.locator('[data-refine-list=categories]').count(),0)
        self.page.locator('[data-calendar-mode=events]').click();self.assertEqual(self.page.locator('[data-refine-list=people]').count(),0);self.assertEqual(self.page.locator('[data-refine-list=categories]').count(),1)
    def test_two_departments_or_and_empty_selection_means_all(self):
        self.start();self.mark('departments','Sonoplastia');self.mark('departments','Comunicação');self.assertEqual(self.page.locator('.scale-chip').count(),18);self.assertEqual(self.page.locator('.scale-band,.scale-monthly').count(),0)
        self.assertTrue(self.page.locator('[data-refine-list=departments]').evaluate('e=>e.open'))
        self.mark('departments','Sonoplastia',False);self.assertEqual(self.page.locator('.scale-chip').count(),5)
        self.mark('departments','Comunicação',False);self.assertEqual(self.page.locator('.scale-chip').count(),18);self.assertGreater(self.page.locator('.scale-band').count(),0)
    def test_two_people_or_and_accent_insensitive_internal_search(self):
        self.start('scales');self.dropdown('people');self.page.fill('#calendar-person-search','RÁFAEL');self.mark('people','Rafael Braga')
        self.page.fill('#calendar-person-search','luCAS');self.mark('people','Lucas Borrego')
        self.assertTrue(self.page.locator('[data-refine-list=people]').get_by_label('Rafael Braga',exact=True).is_checked());self.assertEqual(self.page.locator('.scale-chip').count(),5)
        self.assertEqual(self.page.locator('#calendar-person-search').input_value(),'luCAS');self.page.fill('#calendar-person-search','');self.assertTrue(self.page.get_by_label('Lucas Borrego',exact=True).is_checked())
        self.assertIn('Filtros (2)',self.page.locator('#calendar-filters-toggle').inner_text())
    def test_departments_and_people_combined_with_zero_results(self):
        self.start('scales');self.mark('departments','Sonoplastia');self.mark('departments','Comunicação');self.mark('people','Lucas Borrego');self.mark('people','Henrique Franco');self.assertEqual(self.page.locator('.scale-chip').count(),4)
        self.mark('departments','Sonoplastia',False);self.assertEqual(self.page.locator('.scale-chip').count(),1)
        self.mark('people','Henrique Franco',False);self.assertEqual(self.page.locator('.scale-chip').count(),0);self.assertIn('0 escalas pontuais',self.page.locator('.scale-result').inner_text())
    def test_modes_clear_hidden_people_and_categories_keep_departments(self):
        self.start('scales');self.mark('people','Rafael Braga');self.assertEqual(self.page.locator('.scale-chip').count(),2)
        self.page.locator('[data-calendar-mode=all]').click();self.assertEqual(self.page.locator('.scale-chip').count(),18);self.assertEqual(self.page.locator('.calendar-filter-chip').count(),0)
        self.page.locator('[data-calendar-mode=events]').click();self.mark('categories','Programação Geral');self.mark('departments','Sonoplastia')
        self.page.locator('[data-calendar-mode=scales]').click();self.assertEqual(self.page.locator('.scale-chip').count(),13);self.assertEqual(self.page.locator('.calendar-filter-chip').count(),1)
    def test_categories_or_and_department_excludes_unassigned_general_events(self):
        self.start('events');self.published_fixture();self.mark('categories','Programação Geral');self.mark('categories','Programação Departamental');self.mark('departments','Sonoplastia')
        chips=self.page.locator('.event-chip').all_text_contents();self.assertEqual(len(chips),1);self.assertIn('Evento de som fictício',chips[0]);self.assertIn('restritas aos departamentos',self.page.locator('.calendar-filter-hint').inner_text())
        self.mark('departments','Sonoplastia',False);self.assertIn('Evento geral fictício',self.page.locator('.scale-calendar').inner_text());self.assertNotIn('Atividade reservada fictícia',self.page.locator('.scale-calendar').inner_text())
    def test_reserved_and_pending_are_explicit_no_reclassification_of_sources(self):
        self.start('events');source=self.page.evaluate('IASDPIEvents.sources()');self.mark('categories','Atividade Reservada');self.assertEqual(self.page.locator('.event-chip').count(),0)
        self.assertIn('Classificação pendente',self.page.locator('#calendar-refine-panel').inner_text());self.published_fixture();self.assertEqual(self.page.locator('.event-chip').count(),1)
        self.mark('categories','Pendente de revisão');self.assertGreater(self.page.locator('.event-chip').count(),1);self.assertEqual(source,self.page.evaluate('IASDPIEvents.sources()'))
    def test_chips_remove_individually_and_count(self):
        self.start('scales');self.mark('departments','Sonoplastia');self.mark('people','Lucas Borrego');self.mark('people','Rafael Braga')
        self.assertEqual(self.page.locator('.calendar-filter-chip').count(),3);self.assertEqual(self.page.locator('#calendar-filters-toggle').inner_text().strip(),'Filtros (3)')
        self.page.get_by_role('button',name='Remover pessoa: Rafael Braga',exact=True).click();self.assertEqual(self.page.locator('.calendar-filter-chip').count(),2);self.assertEqual(self.page.locator('.scale-chip').count(),3)
    def test_clear_resets_extras_keeps_mode_and_done_only_closes(self):
        self.start('scales');self.mark('people','Rafael Braga');self.page.locator('[data-calendar-done]').click();self.assertFalse(self.page.locator('#calendar-refine-panel').is_visible());self.assertEqual(self.page.locator('.scale-chip').count(),2)
        self.panel();self.assertTrue(self.page.get_by_label('Rafael Braga',exact=True).is_checked());self.page.locator('[data-calendar-clear]').click();self.assertEqual(self.page.locator('.calendar-filter-chip').count(),0);self.assertEqual(self.page.locator('.scale-chip').count(),18);self.assertEqual(self.page.locator('[data-calendar-mode=scales]').get_attribute('aria-pressed'),'true')
    def test_selection_persists_month_change_and_stays_open_during_checks(self):
        self.start('scales');self.mark('departments','Sonoplastia');self.mark('people','Rafael Braga');self.assertTrue(self.page.locator('[data-refine-list=people]').evaluate('e=>e.open'));self.page.locator('[data-scale-action=next]').click();self.assertEqual(self.page.locator('.calendar-filter-chip').count(),2)
        self.assertTrue(self.page.get_by_label('Rafael Braga',exact=True).is_checked());self.assertEqual(self.page.locator('.scale-chip').count(),0)
        self.page.locator('[data-scale-action=previous]').click();self.assertEqual(self.page.locator('.scale-chip').count(),2)
    def test_search_no_match_does_not_clear_selection_or_filter_without_checkbox(self):
        self.start('scales');self.mark('people','Rafael Braga');self.page.fill('#calendar-person-search','zz-nome-inexistente');self.assertTrue(self.page.locator('.calendar-search-empty').is_visible());self.assertEqual(self.page.locator('.scale-chip').count(),2)
        self.page.fill('#calendar-person-search','');self.assertTrue(self.page.get_by_label('Rafael Braga',exact=True).is_checked())
    def test_keyboard_escape_outside_and_focus(self):
        self.start('scales');self.panel();summary=self.page.locator('#calendar-people-summary');summary.focus();self.page.keyboard.press('Enter');self.page.wait_for_function("()=>document.querySelector('[data-refine-list=people]').open")
        self.page.locator('#calendar-person-search').focus();self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('[data-refine-list=people]').evaluate('e=>e.open'));self.assertTrue(summary.evaluate('e=>e===document.activeElement'))
        self.page.keyboard.press('Escape');self.assertFalse(self.page.locator('#calendar-refine-panel').is_visible());self.assertTrue(self.page.locator('#calendar-filters-toggle').evaluate('e=>e===document.activeElement'))
        self.dropdown('departments');self.page.locator('#scale-month-title').click();self.assertFalse(self.page.locator('[data-refine-list=departments]').evaluate('e=>e.open'))
    def test_responsive_open_panel_chips_and_details(self):
        self.start('scales');self.mark('people','Lucas Borrego');self.mark('people','Rafael Braga');self.page.locator('[data-scale-action=day][data-date="2026-10-03"]').click();self.assertIn('Lucas Borrego',self.page.locator('#scale-selected').inner_text())
        self.dropdown('people');out=base.ROOT/'dist/calendar-refine';out.mkdir(exist_ok=True,parents=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.assertTrue(self.page.locator('.calendar-modes button').evaluate_all('els=>els.every(e=>e.scrollWidth<=e.clientWidth)'))
            self.assertTrue(self.page.locator('.calendar-check-option:not([hidden])').first.evaluate('e=>e.querySelector("input").getBoundingClientRect().right<=e.querySelector("span").getBoundingClientRect().left'))
            if width in [390,1440]:self.page.screenshot(path=str(out/('filters-'+str(width)+'.png')),full_page=True)
    def test_church_change_clears_previous_filter_context(self):
        self.start('scales');self.mark('people','Rafael Braga');self.page.evaluate("()=>window.dispatchEvent(new Event('iasdpi-church-changed'))");self.page.evaluate('render()');self.assertEqual(self.page.locator('.calendar-filter-chip').count(),0);self.assertEqual(self.page.locator('[data-calendar-mode=all]').get_attribute('aria-pressed'),'true')
    def test_quick_departments_and_dropdown_share_selection_both_directions(self):
        self.start('scales');self.page.locator('[data-calendar-quick-department="Sonoplastia"]').click();self.assertEqual(self.page.locator('.scale-chip').count(),13)
        self.assertTrue(self.dropdown('departments').get_by_label('Sonoplastia',exact=True).is_checked())
        self.mark('departments','Comunicação');self.assertEqual(self.page.locator('[data-calendar-quick-department="Comunicação"]').get_attribute('aria-pressed'),'true');self.assertEqual(self.page.locator('.scale-chip').count(),18)
        self.mark('departments','Sonoplastia',False);self.assertEqual(self.page.locator('[data-calendar-quick-department="Sonoplastia"]').get_attribute('aria-pressed'),'false');self.assertEqual(self.page.locator('.scale-chip').count(),5)
        self.page.locator('[data-calendar-quick-department="Comunicação"]').click();self.assertFalse(self.page.get_by_label('Comunicação',exact=True).is_checked());self.assertEqual(self.page.locator('[data-calendar-quick-all]').get_attribute('aria-pressed'),'true');self.assertGreater(self.page.locator('.scale-band').count(),0)
    def test_quick_all_preserves_people_and_quick_filters_are_contextual(self):
        self.start('scales');self.mark('people','Rafael Braga');self.page.locator('[data-calendar-quick-department="Comunicação"]').click();self.assertEqual(self.page.locator('.scale-chip').count(),0)
        self.page.locator('[data-calendar-quick-all]').click();self.assertEqual(self.page.locator('.scale-chip').count(),2);self.assertEqual(self.page.locator('.calendar-filter-chip').count(),1)
        self.page.locator('[data-calendar-mode=events]').click();self.assertEqual(self.page.locator('.calendar-quick-departments').count(),0)
        self.page.locator('[data-calendar-mode=scales]').click();button=self.page.locator('[data-calendar-quick-department="Sonoplastia"]');button.focus();self.page.keyboard.press('Space');self.assertEqual(button.get_attribute('aria-pressed'),'true');self.assertTrue(button.evaluate('e=>e===document.activeElement'))
        self.page.locator('[data-scale-action=next]').click();self.assertEqual(button.get_attribute('aria-pressed'),'true');self.assertTrue(self.page.get_by_label('Sonoplastia',exact=True).is_checked())
    def test_quick_departments_responsive_position_and_accessibility(self):
        self.start('scales');self.page.locator('[data-calendar-quick-department="Sonoplastia"]').click()
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            toolbar=self.page.locator('.calendar-filter-toolbar').bounding_box();quick=self.page.locator('.calendar-quick-departments').bounding_box();self.assertGreaterEqual(quick['y'],toolbar['y']+toolbar['height'])
            self.assertEqual(self.page.locator('.calendar-quick-departments [aria-pressed]').count(),6)
