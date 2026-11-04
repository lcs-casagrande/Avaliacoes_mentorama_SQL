"""UI real B1 no Chromium, RPC simulada. RLS/persistência reais estão na suíte SQL."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import calendar
import json
import shutil
import tempfile
import threading
import unittest
import test_frontend_access as base
import test_schedule_demo as demo

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ScheduleManagementBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();demo.builder.build(cls.temp.name,management_preview=True)
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=cls.temp.name));cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);cls.url=f'http://127.0.0.1:{cls.http.server_port}/'
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.thread.join();cls.temp.cleanup()
    def setUp(self):
        self.context=self.browser.new_context();self.page=self.context.new_page();self.errors=[];self.requests=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('request',lambda r:self.requests.append(r.url))
        self.page.goto(self.url);self.page.wait_for_selector('#b1-scope');self.month('2026-10')
    def tearDown(self):
        self.assertEqual(self.errors,[]);self.assertTrue(all(r.startswith(self.url) for r in self.requests));self.context.close()
    def month(self,month):
        self.page.locator('#b1-scope [name=month]').fill(month);self.page.locator('#b1-scope button').click();self.page.wait_for_selector('#b1-recurring')
    def generate(self):
        form=self.page.locator('#b1-recurring');form.locator('[name=title]').fill('Culto fictício de sábado')
        form.locator('[name=start]').fill('09:30');form.locator('[name=end]').fill('11:30')
        form.locator('[value="3"]').uncheck();form.locator('[value="0"]').uncheck();form.locator('button').click()
        self.page.wait_for_function('IASDPIB1Preview.events.length===5')
    def assign(self,filled=True):
        self.generate();self.page.locator('.b1-event-list input').first.check();self.page.locator('#b1-add button').click()
        if filled:self.page.locator('.b1-requirement select').first.select_option('00000000-0000-4000-8000-000000000020')
    def test_dates_all_months_and_leap_year(self):
        for year in [2024,2026,2027,2030]:
            for month in range(1,13):
                value=f'{year}-{month:02}'
                actual=self.page.evaluate('(m)=>IASDPIScheduleManagement.dates(m,[0,3,6])',value)
                expected=[f'{value}-{day:02}' for day in range(1,calendar.monthrange(year,month)[1]+1) if calendar.weekday(year,month,day) in [6,2,5]]
                self.assertEqual(actual,expected)
        with self.assertRaises(Exception):self.page.evaluate("IASDPIScheduleManagement.dates('2026-13',[6])")
    def test_no_assumed_hours_or_person_duplicates(self):
        self.assertEqual(self.page.locator('[name=start]').input_value(),'');self.assertEqual(self.page.locator('[name=end]').input_value(),'')
        self.generate();self.assertEqual(self.page.locator('.b1-event-list input').count(),5)
        self.page.locator('#b1-recurring button').click();self.assertEqual(self.page.locator('.b1-event-list input').count(),5)
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),0)
        self.page.locator('.b1-event-list input').first.check();self.page.locator('#b1-add button').click();self.page.locator('[data-b1-action=save]').click()
        self.page.locator('#b1-scope [name=department]').select_option('00000000-0000-4000-8000-000000000002');self.page.locator('#b1-scope button').click()
        self.page.locator('.b1-event-list input').first.check();self.page.locator('#b1-add button').click()
        self.assertIn('Diácono',self.page.locator('.b1-requirement legend').inner_text())
    def test_extra_event_date_and_overnight(self):
        self.page.get_by_text('Adicionar evento extraordinário',exact=True).click()
        form=self.page.locator('#b1-extra');form.locator('[name=extraTitle]').fill('Vigília fictícia')
        form.locator('[name=extraDate]').fill('10/10/2026');form.locator('[name=extraEndDate]').fill('11/10/2026')
        form.locator('[name=extraStart]').fill('22:00');form.locator('[name=extraEnd]').fill('01:00');form.locator('button').click()
        self.assertIn('Vigília fictícia',self.page.locator('.b1-event-list').inner_text());self.assertIn('22:00–01:00',self.page.locator('.b1-event-list').inner_text())
    def test_save_confirmed_same_ids_reopen_version_history(self):
        self.assign();self.page.locator('[data-b1-action=save]').click()
        self.assertIn('versão 1',self.page.locator('.b1-status').inner_text())
        before=self.page.evaluate('[...IASDPIB1Preview.plans.values()][0]')
        self.page.locator('[name=planTitle]').fill('Escala fictícia revisada');self.page.locator('[data-b1-action=save]').click()
        after=self.page.evaluate('[...IASDPIB1Preview.plans.values()][0]');self.assertEqual(before['id'],after['id'])
        self.assertEqual(before['requirements'][0]['assignments'],after['requirements'][0]['assignments'])
        self.page.locator('[data-b1-action=reload]').click();self.assertEqual(self.page.locator('[name=planTitle]').input_value(),'Escala fictícia revisada')
        self.page.locator('[data-b1-action=version][data-version="1"]').click();self.assertIn('Versão 1',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),1)
    def test_vacancies_draft_and_publish_explicit(self):
        self.assign(False);self.assertIn('1 vagas pendentes',self.page.locator('.b1-status').inner_text())
        self.page.locator('[data-b1-action=save]').click();self.assertIn('Rascunho',self.page.locator('.b1-status').inner_text())
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click()
        self.assertIn('vagas pendentes',self.page.locator('.b1-status [role=alert]').inner_text())
        self.assertEqual(self.page.evaluate('[...IASDPIB1Preview.plans.values()][0].status'),'draft')
        self.page.locator('.b1-requirement select').select_option('00000000-0000-4000-8000-000000000020')
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-b1-action=publish]').click();self.assertEqual(self.page.evaluate('[...IASDPIB1Preview.plans.values()][0].status'),'draft')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.assertIn('Publicada',self.page.locator('.b1-status').inner_text())
    def test_connection_failure_preserves_fields_and_retry(self):
        self.assign();self.page.locator('[name=planTitle]').fill('Não perder este rascunho')
        self.page.evaluate('IASDPIB1Preview.failNext=true');self.page.locator('[data-b1-action=save]').click()
        self.assertEqual(self.page.locator('[name=planTitle]').input_value(),'Não perder este rascunho')
        self.assertIn('Falha temporária',self.page.locator('.b1-status [role=alert]').inner_text())
        self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),0)
        self.page.locator('[data-b1-action=save]').click();self.assertEqual(self.page.evaluate('IASDPIB1Preview.plans.size'),1)
    def test_stale_save_compare_no_automatic_overwrite(self):
        self.assign();self.page.locator('[data-b1-action=save]').click()
        self.page.locator('[name=planTitle]').fill('Minha edição pendente')
        self.page.evaluate("const p=[...IASDPIB1Preview.plans.values()][0];p.version++;p.title='Outro dispositivo';")
        self.page.locator('[data-b1-action=save]').click();self.assertIn('outro dispositivo',self.page.locator('.b1-status [role=alert]').inner_text())
        self.page.locator('[data-b1-action=compare]').click();self.assertEqual(self.page.locator('[name=planTitle]').input_value(),'Minha edição pendente')
        self.assertEqual(self.page.evaluate('[...IASDPIB1Preview.plans.values()][0].title'),'Outro dispositivo')
    def test_navigation_guard_to_calendar_and_back(self):
        self.assign();self.page.once('dialog',lambda d:d.dismiss());self.page.locator('[data-demo-view=schedule-calendar]').click()
        self.assertEqual(self.page.locator('.b1-requirement').count(),1)
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-demo-view=schedule-calendar]').click();self.page.wait_for_selector('.scale-calendar')
        self.page.get_by_role('link',name='Criar escala',exact=True).click();self.page.wait_for_selector('#b1-scope')
    def test_responsive_long_title_and_accessible_volunteer_labels(self):
        self.assign();self.page.locator('[name=planTitle]').fill('Nome longo '*20)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.assertIn('Culto fictício',self.page.locator('.b1-requirement select').get_attribute('name') and self.page.locator('.b1-requirement legend').inner_text())
        self.page.locator('.b1-requirement select').focus();self.assertTrue(self.page.locator('.b1-requirement select').evaluate('(e)=>e===document.activeElement'))
    def test_no_remote_connections_and_reload_explained(self):
        self.assertIn('reiniciam ao recarregar',self.page.locator('.demo-banner').inner_text())
        self.assertTrue(self.page.evaluate("fetch('https://example.invalid').then(()=>false,()=>true)"))
        self.assertEqual(self.page.evaluate('localStorage.length'),0)

class ScheduleManagementPackageTests(unittest.TestCase):
    def test_preview_package_is_fictional_and_no_real_connections(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest=demo.builder.build(temp,management_preview=True);self.assertFalse(manifest['database_connected'])
            text=''.join(p.read_text() for p in Path(temp).iterdir())
            for value in ['Henrique','Mini Lucas','Adriano Borrego','sb_publishable_','sb_secret_','https://','createClient']:
                self.assertNotIn(value,text)
    def test_v3_requires_management_and_retains_v2_rollback_support(self):
        import test_pages_release as release
        builder=release.builder
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);out=root/'v3';manifest=builder.build(out)
            self.assertEqual(manifest['manifest_version'],6);builder.validate_package(out)
            manifest['manifest_version']=2;del manifest['files']['schedule-management.js'];(out/'schedule-management.js').unlink();(out/'manifest.json').write_text(json.dumps(manifest))
            self.assertEqual(builder.validate_package(out)['manifest_version'],2)
            current=root/'current';builder.build(current,previous_site=out)
            rollback=root/'rollback';builder.build_rollback(rollback,out,current)
            self.assertEqual(builder.validate_package(rollback)['manifest_version'],2)

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ScheduleManagementAuthBridgeTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    setUp=base.FrontendAccessTests.setUp
    tearDown=base.FrontendAccessTests.tearDown
    def supabase(self,route):
        if '/rest/v1/rpc/iasdpi_schedule_plan_save' in route.request.url:
            route.fulfill(status=409,json={'code':'23P01','message':'Conflito: voluntário já escalado em outro departamento.'});return
        base.FrontendAccessTests.supabase(self,route)
    def test_real_auth_transport_exposes_safe_conflict_message(self):
        self.page.goto(self.base+'#organization')
        result=self.page.evaluate("IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_schedule_plan_save',{method:'POST',body:'{}'}).then(()=>null,e=>({message:e.message,code:e.code}))")
        self.assertEqual(result['code'],'23P01');self.assertIn('outro departamento',result['message'])
    def test_readonly_transport_allows_workspace_not_mutations(self):
        self.page.goto(self.base+'#organization')
        result=self.page.evaluate("""()=>{window.IASDPIConfig={...IASDPIConfig,remoteReadOnly:true};return ['iasdpi_schedule_workspace','iasdpi_schedule_plan_version','iasdpi_schedule_event_create','iasdpi_schedule_plan_save'].map(name=>IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/'+name,'POST'));}""")
        self.assertEqual(result,[True,True,False,False])
