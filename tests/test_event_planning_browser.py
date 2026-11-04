"""Gestão de eventos 022 no navegador; banco/Auth simulados, sem chamadas reais."""
from pathlib import Path
import subprocess,unittest
import test_calendar_privacy_browser as privacy
import test_frontend_access as base
class EventPlanningBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        privacy.CalendarPrivacyBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--event-management-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(privacy.CalendarPrivacyBrowserTests.tearDownClass.__func__)
    def setUp(self):
        privacy.CalendarPrivacyBrowserTests.setUp(self)
        self.page.clock.set_fixed_time('2026-11-04T15:00:00Z');self.page.reload();self.page.wait_for_selector('.church-portal-cards')
    tearDown=privacy.CalendarPrivacyBrowserTests.tearDown
    go=privacy.CalendarPrivacyBrowserTests.go;choose=privacy.CalendarPrivacyBrowserTests.choose;login=privacy.CalendarPrivacyBrowserTests.login
    def form(self,title='Evento sintético para revisão',date='07/11/2026',public='departmental',organizer='local_church',spaces=()):
        self.go('events');self.page.wait_for_selector('[data-event-new]');self.page.locator('[data-event-new]').click()
        form=self.page.locator('#event-editor');form.locator('[name=title]').fill(title);form.locator('[name=date]').fill(date)
        form.locator('[name=start_time]').fill('14:00');form.locator('[name=end_time]').fill('16:00')
        form.locator('[name=event_organizer]').select_option(organizer);form.locator('[name=program_category]').select_option(public)
        if spaces:
            self.page.locator('.event-space-picker>summary').click()
            for code in spaces:
                if not self.page.locator('.event-space-picker').evaluate('e=>e.open'):self.page.locator('.event-space-picker>summary').click()
                self.page.locator('[data-event-space][value='+code+']').check()
    def save(self,status='published'):
        self.page.locator('#event-editor button[type=submit][value='+status+']').click()
        self.page.wait_for_function("()=>!document.querySelector('#event-editor[aria-busy=true]')")
    def calendar(self):
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render();}")
        self.page.wait_for_function("()=>![...document.querySelectorAll('[role=status]')].some(e=>/Carregando eventos gerenciados/.test(e.textContent))")
    def test_four_sections_no_duplicate_organizer_or_audience(self):
        self.login();self.form()
        self.assertEqual(self.page.locator('.event-form-section h3').all_text_contents(),['Informações do evento','Organização','Locais e reservas','Participação e visibilidade'])
        for name in ['category','department_id','organizer_kind','audience']:self.assertEqual(self.page.locator('#event-editor [name='+name+']').count(),0)
        self.assertEqual(self.page.locator('#event-editor [name=event_organizer]').count(),1)
        self.assertEqual(self.page.locator('#event-editor [name=program_category] option:not([value=""])').all_text_contents(),['Programação Geral','Programação Departamental','Atividade Reservada'])
    def test_general_with_department_organizer_is_pending_and_hidden(self):
        self.login();self.form(public='general',organizer='department:00000000-0000-4000-8000-000000000003')
        self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Pendente de aprovação')")
        row=self.page.evaluate("[...IASDPIE1Demo.events.values()].find(e=>e.title==='Evento sintético para revisão')")
        self.assertEqual(row['category'],'department');self.assertEqual(row['program_category'],'general');self.assertEqual(row['status'],'draft')
        self.calendar();self.assertNotIn(row['title'],self.page.locator('.scale-calendar').inner_text())
    def test_multi_space_public_event_then_unique_conflict_detailed(self):
        self.login();self.form(title='Reserva de Nave e Pátio',spaces=['nave','patio']);self.save()
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        self.form(title='Tentativa sobreposta',spaces=['nave']);self.save()
        self.page.wait_for_function("()=>[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('Reserva de Nave e Pátio'))")
        text=self.page.locator('[role=alert]').inner_text();self.assertIn('Nave',text);self.assertIn('07/11/2026',text)
        self.assertFalse(self.page.evaluate("[...IASDPIE1Demo.events.values()].some(e=>e.title==='Tentativa sobreposta')"))
    def test_weekly_series_conflict_continue_pending_not_published(self):
        self.login();self.form(title='Reserva anterior',spaces=['quadra']);self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('confirmada')")
        self.form(title='Sábados recorrentes',spaces=['quadra']);self.page.select_option('#event-editor [name=recurrence]','weekly');self.page.select_option('#event-editor [name=recurrence_weekday]','6');self.save()
        self.page.wait_for_selector('[data-event-confirm]');self.assertEqual(self.page.evaluate('IASDPIEventPlanningDemo.series.size'),0)
        self.assertIn('Reserva anterior',self.page.locator('.event-conflict-panel').inner_text())
        self.page.locator('[data-event-confirm]').click();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Pendente de aprovação')")
        records=self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Sábados recorrentes')")
        self.assertGreater(len(records),1);self.assertTrue(all(e['status']=='draft' for e in records));self.assertTrue(all(e['date']<='2026-12-31' for e in records))
        self.calendar();self.assertNotIn('Sábados recorrentes',self.page.locator('.scale-calendar').inner_text())
    def test_same_title_and_time_in_different_rooms_is_not_a_duplicate(self):
        self.login()
        for code in ['nave','quadra']:
            self.form(title='Reunião de equipes',spaces=[code]);self.save()
            self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        rows=self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Reunião de equipes')")
        self.assertEqual(len(rows),2);self.assertNotEqual(rows[0]['id'],rows[1]['id'])
    def test_monthly_first_thursday_shared_spaces_publishes(self):
        self.login();self.form(title='Primeiras quintas',date='01/11/2026',spaces=['salas','externo'])
        self.page.select_option('#event-editor [name=recurrence]','monthly');self.page.select_option('#event-editor [name=recurrence_weekday]','4');self.page.select_option('#event-editor [name=recurrence_ordinal]','1');self.save()
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        dates=self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Primeiras quintas').map(e=>e.date)")
        self.assertEqual(dates,['2026-11-05','2026-12-03'])
    def test_all_day_disables_hours_and_can_be_unchecked(self):
        self.login();self.form(spaces=['nave']);self.page.once('dialog',lambda d:d.accept());self.page.locator('#event-editor [name=all_day]').check()
        self.assertTrue(self.page.locator('#event-editor [name=start_time]').is_disabled());self.assertTrue(self.page.locator('#event-editor [name=end_time]').is_disabled())
        self.page.locator('#event-editor [name=all_day]').uncheck();self.assertTrue(self.page.locator('#event-editor [name=start_time]').is_enabled())
        self.page.locator('#event-editor [name=all_day]').check();self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
    def test_five_widths_keyboard_and_captures(self):
        self.login();self.form(spaces=['nave','patio']);self.page.select_option('#event-editor [name=recurrence]','monthly')
        out=base.ROOT/'dist/event-management'
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        for width,name in [(1440,'desktop'),(390,'mobile')]:
            self.page.set_viewport_size({'width':width,'height':1000});self.page.screenshot(path=str(out/('eventos-'+name+'.png')),full_page=True)
            self.page.locator('#event-editor').screenshot(path=str(out/('eventos-form-'+name+'.png')))
        self.page.focus('#event-editor [name=program_category]');self.page.keyboard.press('Tab');self.assertEqual(self.page.evaluate('document.activeElement.name'),'is_restricted')
    def test_edit_old_event_preserves_unknown_fields_and_source_identity(self):
        self.login();self.go('events');self.page.wait_for_selector('[data-event-new]')
        original=self.page.evaluate("()=>{const e=[...IASDPIE1Demo.events.values()][0];e.location='Local antigo não conciliado';e.audience='specific';return structuredClone(e);}")
        self.page.locator('[data-events-retry]').click();self.page.wait_for_selector('[data-event-open="'+original['id']+'"]');self.page.locator('[data-event-open="'+original['id']+'"]').first.click()
        self.page.locator('#event-editor [name=description]').fill('Descrição revisada');self.save('draft')
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Confirmação recebida')")
        after=self.page.evaluate('(id)=>IASDPIE1Demo.events.get(id)',original['id'])
        for field in ['id','source_key','date','end_date','start_time','end_time','location','audience','program_category']:self.assertEqual(after.get(field),original.get(field),field)
    def test_series_edit_all_and_cancel_single_from_interface(self):
        self.login();self.form(title='Série editável',spaces=['salas']);self.page.select_option('#event-editor [name=recurrence]','weekly');self.page.select_option('#event-editor [name=recurrence_weekday]','6');self.save()
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        ids=self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Série editável').map(e=>e.id)")
        self.page.select_option('#event-editor [name=edit_scope]','all');self.page.locator('#event-editor [name=title]').fill('Toda série revisada');self.save()
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        self.assertEqual(self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Toda série revisada').map(e=>e.id)"),ids)
        self.page.on('dialog',lambda d:d.accept('Cancelamento da ocorrência de teste') if d.type=='prompt' else d.accept())
        self.page.locator('#event-editor [data-event-cancel]').click();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Cancelamento confirmado')")
        self.assertEqual(self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Toda série revisada'&&e.status==='cancelled').length"),1)
    def test_refresh_does_not_rebase_unsaved_series_over_newer_version(self):
        self.login();self.form(title='Série de concorrência',spaces=['salas']);self.page.select_option('#event-editor [name=recurrence]','weekly');self.page.select_option('#event-editor [name=recurrence_weekday]','6');self.save()
        self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
        self.page.select_option('#event-editor [name=edit_scope]','all');self.page.locator('#event-editor [name=title]').fill('Edição local pendente')
        self.page.evaluate("""async()=>{const series=[...IASDPIEventPlanningDemo.series.values()][0];await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_event_series_save',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(await IASDPIAuth.requireIdentity()).token},body:JSON.stringify({p_id:series.id,p_expected_version:series.version,p_patch:{title:'Versão remota recente',status:'published'},p_request_id:crypto.randomUUID(),p_scope:'all',p_occurrence:null,p_accept_conflicts:false})});}""")
        self.page.locator('[data-events-retry]').click();self.page.wait_for_function("()=>!document.querySelector('#app [role=status]')?.textContent.includes('Carregando eventos')")
        self.save();self.page.wait_for_function("()=>[...document.querySelectorAll('[role=alert]')].some(e=>/mudou|alterada/.test(e.textContent))")
        self.assertEqual(self.page.locator('#event-editor [name=title]').input_value(),'Edição local pendente')
        self.assertTrue(self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.series_id).every(e=>e.title==='Versão remota recente')"))
