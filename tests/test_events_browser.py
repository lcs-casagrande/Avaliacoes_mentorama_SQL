"""E1 em navegador local: referências públicas reais, Auth/RPC exclusivamente simulados."""
from pathlib import Path
import json,subprocess,unittest
import test_registry_identities_browser as g84
import test_registry_consolidation_browser as g83
import test_registry_integration_browser as g82
import test_frontend_access as base

class EventBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        g84.RegistryIdentitiesBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--events-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(g84.RegistryIdentitiesBrowserTests.tearDownClass.__func__)
    setUp=g83.RegistryConsolidationBrowserTests.setUp
    tearDown=g83.RegistryConsolidationBrowserTests.tearDown
    go=g82.RegistryIntegrationBrowserTests.go
    choose=g82.RegistryIntegrationBrowserTests.choose
    def login(self,alias='admin.iasdpi'):
        self.choose();self.page.fill('#portal-login-form [name=email]',alias);self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar')
    def manager(self):self.go('events');self.page.wait_for_selector('[data-event-new]')
    def form(self,title='Evento E1 para avaliação'):
        self.manager();self.page.locator('[data-event-new]').click();self.page.fill('#event-editor [name=title]',title);self.page.fill('#event-editor [name=date]','10/10/2026')
    def save(self,status='draft'):
        self.page.locator('#event-editor button[value='+status+']').click();self.page.wait_for_function("()=>!document.querySelector('#event-editor[aria-busy=true]')&&(document.querySelector('#event-save-state')?.textContent.toLowerCase().includes('confirm')||document.querySelector('#app [role=alert]'))")
    def calendar(self):
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-10'});render();}");self.page.wait_for_function("()=>!document.querySelector('.event-categories')?.nextElementSibling?.textContent.includes('Carregando eventos')")
    def test_real_sources_twenty_assignments_seventeen_october_events_and_elders(self):
        self.calendar();self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
        self.assertEqual(self.page.evaluate("IASDPIEvents.sources().filter(e=>e.date.startsWith('2026-10')).length"),17)
        self.assertGreater(self.page.locator('.event-chip').count(),0);self.assertGreater(self.page.locator('.scale-band').count(),0)
        self.assertEqual(self.page.locator('[data-event-category]').all_text_contents(),['Escalas','Eventos da Igreja','Eventos de Departamentos'])
    def test_category_filters_combine_and_scale_filters_do_not_hide_events(self):
        self.calendar();count=self.page.locator('.event-chip').count();self.page.locator('[data-event-category=scales]').click();self.assertEqual(self.page.locator('.scale-chip,.scale-band,.scale-monthly').count(),0);self.assertEqual(self.page.locator('.event-chip').count(),count)
        self.page.locator('[data-event-category=church]').click();self.page.locator('[data-event-category=department]').click();self.assertEqual(self.page.locator('.event-chip').count(),0)
        self.page.locator('[data-event-category=department]').click();self.assertGreater(self.page.locator('.event-chip').count(),0)
        self.page.locator('[data-scale-action=all]').click();self.assertGreater(self.page.locator('.event-chip').count(),0)
        self.page.locator('[data-scale-action=next]').click();self.assertEqual(self.page.locator('[data-event-category=scales]').get_attribute('aria-pressed'),'false')
    def test_aliases_iasdpi_use_same_profiles_and_old_test_alias_is_not_login(self):
        names=self.page.evaluate('IASDPIG4Demo.accounts().map(a=>a.alias)')
        for alias in ['admin.iasdpi','som.iasdpi','musica.iasdpi','anciao.iasdpi','multi.iasdpi','leitura.iasdpi']:self.assertIn(alias,names)
        self.assertFalse(any(x.endswith('.teste') for x in names));self.login('multi.iasdpi');self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'));self.assertEqual(set(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents()),{'Música','Sonoplastia'})
    def test_create_publish_edit_cancel_and_history(self):
        self.login();self.form('Evento da igreja confirmado');self.save();self.assertEqual(self.page.locator('[role=alert]').count(),0)
        self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),1);self.assertEqual(self.page.evaluate("[...IASDPIE1Demo.events.values()][0].status"),'draft')
        self.save('published');self.calendar();self.assertIn('Evento da igreja confirmado',self.page.locator('.scale-calendar').inner_text())
        self.manager();self.page.locator('[data-event-open]').first.click();self.page.fill('#event-editor [name=title]','Alteração ainda privada');self.save()
        self.calendar();self.assertNotIn('Alteração ainda privada',self.page.locator('.scale-calendar').inner_text());self.assertIn('Evento da igreja confirmado',self.page.locator('.scale-calendar').inner_text())
        self.manager();self.page.locator('[data-event-open]').first.click();self.save('published')
        self.page.on('dialog',lambda d:d.accept('Motivo informado') if d.type=='prompt' else d.accept());self.page.locator('[data-event-cancel]').click();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Cancelamento confirmado')")
        self.page.locator('[data-event-history]').click();self.page.wait_for_selector('.event-history li');self.assertEqual(self.page.locator('.event-history li').count(),5)
        self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),1);self.calendar();self.assertNotIn('Alteração ainda privada',self.page.locator('.scale-calendar').inner_text())
    def test_import_preview_reuses_source_id_and_avoids_duplicate(self):
        self.login();self.manager();self.page.locator('.event-source-list').wait_for(state='attached');self.page.get_by_text('Conferir eventos da Agenda antes de cadastrar',exact=True).click();self.page.locator('#events-source-month').fill('2026-10');self.page.locator('#events-source-month').dispatch_event('change')
        self.assertEqual(self.page.locator('[data-event-import]').count(),17);self.page.locator('[data-event-import]').first.click();self.assertEqual(self.page.locator('#event-editor [name=category]').input_value(),'department');self.save()
        self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),1)
        if not self.page.locator('#events-source-preview').evaluate('e=>e.open'):
            self.page.get_by_text('Conferir eventos da Agenda antes de cadastrar',exact=True).click()
        self.page.locator('[data-event-open]').filter(has_text='Abrir registro existente').click();self.save();self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),1)
    def test_invalid_times_and_missing_category_do_not_publish(self):
        self.login();self.form();self.page.fill('#event-editor [name=start_time]','25:61');self.save();self.assertIn('HH:mm',self.page.locator('#app [role=alert]').inner_text());self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),0)
        self.page.fill('#event-editor [name=start_time]','');self.page.select_option('#event-editor [name=category]','');self.save('published');self.assertIn('categoria',self.page.locator('#app [role=alert]').inner_text());self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),0)
    def test_leader_own_department_and_viewer_denied(self):
        self.login('som.iasdpi');self.form('Evento de Sonoplastia');self.save('published');self.assertEqual(self.page.locator('[role=alert]').count(),0)
        self.assertEqual(self.page.locator('#event-editor [name=category] option[value=church]').count(),0)
        denied=self.page.evaluate("async()=>{const i=await IASDPIAuth.requireIdentity();try{await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_event_save',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+i.token},body:JSON.stringify({p_id:crypto.randomUUID(),p_expected_version:0,p_request_id:crypto.randomUUID(),p_patch:{title:'Proibido',date:'2026-10-10',category:'church'}})});return false;}catch{return true;}}")
        self.assertTrue(denied)
    def test_stale_version_and_network_failure_keep_fields(self):
        self.login();self.form();self.save();self.page.fill('#event-editor [name=description]','Minha observação')
        self.page.evaluate("()=>{const e=[...IASDPIE1Demo.events.values()][0];e.version++;e.description='Outro dispositivo';}");self.save();self.assertIn('outro dispositivo',self.page.locator('#app [role=alert]').inner_text());self.assertEqual(self.page.locator('[name=description]').input_value(),'Minha observação');self.assertEqual(self.page.evaluate('[...IASDPIE1Demo.events.values()][0].description'),'Outro dispositivo')
    def test_navigation_guard_and_reload_reset(self):
        self.login();self.form();self.page.once('dialog',lambda d:d.dismiss());self.go('schedule-calendar');self.assertTrue(self.page.locator('#event-editor').is_visible())
        self.save();self.page.reload();self.page.wait_for_function('()=>window.IASDPIE1Demo&&window.IASDPIG84Demo');self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),0)
    def test_five_widths_public_detail_and_keyboard(self):
        self.calendar();self.page.locator('[data-scale-action=day][data-date="2026-10-10"]').click();self.assertGreater(self.page.locator('#scale-selected .event-details').count(),1)
        self.assertNotRegex(self.page.locator('#scale-selected').inner_text(),r'\b(?:AM|PM)\b')
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('[data-event-category=church]').focus();self.page.keyboard.press('Space');self.assertEqual(self.page.locator('[data-event-category=church]').get_attribute('aria-pressed'),'false')
        self.login();self.form('Evento com título extenso para conferir a apresentação em dispositivos móveis')
        out=base.ROOT/'dist/events-e1';out.mkdir(parents=True,exist_ok=True)
        for width,label in [(390,'mobile'),(1440,'desktop')]:
            self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.page.screenshot(path=str(out/('events-'+label+'.png')),full_page=True)
    def test_published_event_fields_are_escaped(self):
        self.login();self.form('<img src=x onerror=window.e1xss=true>')
        self.page.fill('#event-editor [name=description]','<script>window.e1xss=true</script>');self.save('published');self.calendar()
        self.page.locator('[data-scale-action=day][data-date="2026-10-10"]').click()
        self.assertEqual(self.page.locator('#app img[onerror]').count(),0);self.assertFalse(self.page.evaluate('Boolean(window.e1xss)'))
    def test_explicit_all_day_checkbox_roundtrip(self):
        self.login();self.form('Evento de dia inteiro');self.page.check('#event-editor [name=all_day]');self.save('published')
        self.assertEqual(self.page.locator('[role=alert]').count(),0)
        e=self.page.evaluate('[...IASDPIE1Demo.events.values()][0]');self.assertTrue(e['all_day']);self.assertIsNone(e['start_time'])
        self.manager();self.page.locator('[data-event-open]').first.click();self.assertTrue(self.page.locator('[name=all_day]').is_checked());self.assertEqual(self.page.locator('[name=start_time]').input_value(),'')
    def test_connection_failure_retry_keeps_inputs_and_same_record(self):
        self.login();self.form('Conexão temporariamente interrompida')
        self.page.evaluate("()=>{const previous=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).includes('/iasdpi_event_save')){window.fetch=previous;throw Error('Conexão indisponível');}return previous(...args);};}")
        self.save();self.assertIn('Conexão indisponível',self.page.locator('#app [role=alert]').inner_text());self.assertEqual(self.page.locator('[name=title]').input_value(),'Conexão temporariamente interrompida');self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),0)
        self.save();self.assertEqual(self.page.locator('#app [role=alert]').count(),0);self.assertEqual(self.page.evaluate('IASDPIE1Demo.events.size'),1)
