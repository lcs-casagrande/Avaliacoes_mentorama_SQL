"""G8.4: portal real, nomes confirmados e backend demonstrativo sem rede."""
from pathlib import Path
import json,subprocess,unittest
import test_registry_consolidation_browser as g83
import test_registry_integration_browser as g82
import test_frontend_access as base
D=g82.D;M=g82.M
class RegistryIdentitiesBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        g83.RegistryConsolidationBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--registry-identities-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(g83.RegistryConsolidationBrowserTests.tearDownClass.__func__)
    setUp=g83.RegistryConsolidationBrowserTests.setUp
    tearDown=g83.RegistryConsolidationBrowserTests.tearDown
    go=g83.RegistryConsolidationBrowserTests.go
    login=g83.RegistryConsolidationBrowserTests.login
    choose=g83.RegistryConsolidationBrowserTests.choose
    admin=g83.RegistryConsolidationBrowserTests.admin
    registry=g83.RegistryConsolidationBrowserTests.registry
    catalog=g83.RegistryConsolidationBrowserTests.catalog
    refresh=g83.RegistryConsolidationBrowserTests.refresh
    confirm_row=g83.RegistryConsolidationBrowserTests.confirm_row
    prefill=g83.RegistryConsolidationBrowserTests.prefill
    row=g83.RegistryConsolidationBrowserTests.row
    person_row=g83.RegistryConsolidationBrowserTests.person_row
    def person(self,name='Luan Vaz'):return next(p for p in self.catalog()['people'] if p['name']==name)
    def create(self,name):return self.page.evaluate("""async name=>{const id=crypto.randomUUID();await IASDPISchedules.request('iasdpi_registry_save',{p_person:id,p_expected_person_version:0,p_person_patch:{name},p_links:[],p_request_id:crypto.randomUUID()});return id;}""",name)
    def test_confirmed_names_unique_and_department_memberships_preserved(self):
        self.admin();self.registry();c=self.catalog();rules=json.loads((base.ROOT/'data/confirmed-person-names.json').read_text())
        for rule in rules:self.assertEqual(len([p for p in c['people'] if p['name']==rule['name']]),1,rule['name'])
        sound=next(d['id'] for d in c['departments'] if d['code']=='sonoplastia');communication=next(d['id'] for d in c['departments'] if d['code']=='comunicacao')
        self.assertEqual(len([m for m in c['memberships'] if m['department_id']==sound]),7);self.assertEqual(len([m for m in c['memberships'] if m['department_id']==communication]),5)
        gabriel=self.person('Gabriel Macedo');self.assertEqual(len([m for m in c['memberships'] if m['person_id']==gabriel['id']]),2)
        for name in ['Samuel Ferreira','Raphael Moreira']:self.assertGreaterEqual(len([m for m in c['memberships'] if m['person_id']==self.person(name)['id']]),2)
    def test_search_by_old_aliases_returns_the_same_id(self):
        self.admin();self.registry();gabriel=self.person('Gabriel Macedo')
        for term in ['Macedo','macedo Logos','Gabriel Macedo']:
            self.page.fill('#registry-search',term);self.assertEqual(self.page.locator('[data-registry-person-row]').count(),1);self.assertTrue(self.person_row(gabriel['id']).is_visible())
        self.page.fill('#registry-search','Paulito');self.assertIn('Paulo Scarpelini',self.page.locator('#registry-people-results').inner_text())
    def test_public_historical_twenty_rows_and_elders_source_intact(self):
        self.page.wait_for_function('()=>Boolean(window.IASDPIG84Demo)');self.page.evaluate('IASDPIG84Demo.ready');before=self.page.evaluate('({rows:structuredClone(IASDPIKnownPreviewSeed.rows),agenda:structuredClone(IASDPIAgendaData.events)})');self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.wait_for_function("()=>IASDPIScheduleCalendar.legacy().some(r=>r.person==='Gabriel Macedo')")
        rows=self.page.evaluate('IASDPIScheduleCalendar.legacy()');self.assertEqual(len(rows),20);self.assertEqual(len([r for r in rows if r['department']=='Sonoplastia']),15);self.assertEqual(len([r for r in rows if r['department']=='Comunicação']),5)
        after=self.page.evaluate('({rows:IASDPIKnownPreviewSeed.rows,agenda:IASDPIAgendaData.events})');self.assertEqual(before,after)
        projected=self.page.evaluate('IASDPIScheduleCalendar.legacy().map(r=>IASDPIRegistry.historical(r))');self.assertTrue(any(r['person']=='Gabriel Macedo' for r in projected));self.assertTrue(any(r.get('original_person')=='macedo Logos' for r in projected));self.assertEqual([(r['id'],r['date']) for r in rows],[(r['id'],r['date']) for r in projected])
    def test_manual_confirmation_preview_cancel_then_apply_and_audit(self):
        self.admin();self.registry();p=self.create('Paulito');self.refresh();self.page.locator('.registry-identities summary').click();g=self.page.locator('[data-identity-group="Paulo Scarpelini"]');g.locator('select').select_option(p);self.page.once('dialog',lambda d:d.dismiss());g.locator('[data-registry-consolidate]').click();self.assertTrue(any(x['id']==p and x['name']=='Paulito' for x in self.catalog()['people']))
        self.page.once('dialog',lambda d:d.accept());g.locator('[data-registry-consolidate]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('Consolidação confirmada')");self.assertEqual(len([x for x in self.catalog()['people'] if x['name']=='Paulo Scarpelini']),1);self.person_row(p).locator('[data-registry-audit]').click();self.page.wait_for_selector('#registry-audit');self.assertIn('registry-identity',self.page.locator('#registry-audit').inner_text())
    def test_leader_cannot_see_or_invoke_administrative_reconciliation(self):
        self.login('som.teste');self.registry();self.assertEqual(self.page.locator('.registry-identities,[data-registry-audit]').count(),0);self.assertEqual(self.page.locator('#registry-department option').count(),1)
        denied=self.page.evaluate("async()=>{try{await IASDPISchedules.request('iasdpi_registry_identity_preview');return false;}catch{return true;}}");self.assertTrue(denied)
        denied=self.page.evaluate("async()=>{try{await IASDPISchedules.request('iasdpi_schedule_save',{p_entity:'person',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{name:'Pessoa forjada',department_id:'00000000-0000-4000-8000-000000000001'},p_request_id:crypto.randomUUID()});return false;}catch{return true;}}");self.assertTrue(denied)
    def test_qualification_and_availability_are_not_inferred(self):
        self.admin();self.registry();self.page.select_option('#registry-department',D);p=self.person();row=self.row(p);self.assertFalse(row.locator('[name=participation_confirmed]').is_checked());self.assertEqual(row.locator('[name=role_ids]:checked').count(),0);self.assertEqual(row.locator('[name=day_0]').input_value(),'unknown');self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.prefill();self.assertEqual(self.page.locator('[data-calendar-volunteer]').evaluate_all('es=>es.filter(e=>e.value).length'),0)
    def test_rename_central_person_updates_organogram_without_changing_id(self):
        self.admin();self.registry();p=self.person();self.person_row(p['id']).locator('[data-registry-edit-person]').click();f=self.page.locator('#registry-person');f.locator('[name=name]').fill('Luan Vaz nome demonstrativo');f.locator('[name=display_name]').fill('Luan Vaz nome demonstrativo');self.page.once('dialog',lambda d:d.accept());f.locator('button:not([type]),button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')");self.go('organization');self.page.wait_for_function("()=>document.querySelector('[data-ministry=Sonoplastia]')?.textContent.includes('Luan Vaz nome demonstrativo')");self.assertEqual(self.person('Luan Vaz nome demonstrativo')['id'],p['id'])
    def test_five_widths_keyboard_and_screenshots(self):
        self.admin();self.registry();out=base.ROOT/'dist/registry-g84';out.mkdir(parents=True,exist_ok=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.focus('#registry-search');self.page.keyboard.type('Rafa');self.page.keyboard.press('Tab');self.assertEqual(self.page.evaluate('document.activeElement.id'),'registry-person-status');self.page.locator('[data-registry-clear-filters]').click()
        for width,label in [(390,'mobile'),(1440,'desktop')]:self.page.set_viewport_size(dict(width=width,height=900));self.page.screenshot(path=str(out/('registry-g84-'+label+'.png')),full_page=True)
    def test_late_administrative_response_after_identity_ended_is_discarded(self):
        self.admin();self.page.evaluate("""()=>{const old=IASDPISchedulePreview.request;IASDPISchedulePreview.request=(n,b)=>n==='iasdpi_registry_identity_preview'?new Promise(resolve=>window.releaseIdentityPreview=()=>resolve(old(n,b))):old(n,b);}""");self.go('schedule-members');self.page.wait_for_function('()=>Boolean(window.releaseIdentityPreview)');self.page.evaluate("window.dispatchEvent(new Event('iasdpi-identity-ended'));window.releaseIdentityPreview();");self.go('church-home');self.page.wait_for_selector('.church-portal-cards');self.assertEqual(self.page.locator('[data-identity-group],#registry-audit').count(),0)
    def test_readonly_gate_allows_metadata_but_blocks_consolidation(self):
        self.assertTrue(self.page.evaluate("()=>{window.IASDPIConfig=Object.freeze({...IASDPIConfig,remoteReadOnly:true});return IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/iasdpi_registry_identity_preview','POST')&&IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/iasdpi_registry_audit','POST')&&!IASDPIAuth.remoteRequestAllowed('/rest/v1/rpc/iasdpi_registry_identity_apply','POST');}"))
    def test_preview_storage_is_isolated_from_real_and_previous_demonstrations(self):
        self.assertEqual(self.page.evaluate('IASDPIConfig.storageNamespace'),'iasdpi-registry-g84-preview-v1')
        for key in ['programs','authSession','cloudConfig']:
            self.assertTrue(self.page.evaluate('key=>IASDPIStorage[key]',key).startswith('iasdpi-registry-g84-preview-v1:'),key)
        self.admin();self.registry();self.assertEqual(self.page.locator('nav [data-page=schedule-members]').inner_text(),'Cadastro Geral')
    def test_old_snapshot_person_ids_resolve_without_duplicating_central_people(self):
        self.admin();self.registry();c=self.catalog();redirects=c['identity_redirects'];self.assertTrue(redirects);self.assertTrue(all(x['id'] not in {p['id'] for p in c['people']} for x in redirects));names=self.page.evaluate('c=>c.identity_redirects.map(x=>IASDPIRegistry.personName(c,x.id))',c);self.assertTrue(all(names));self.assertIn('Gabriel Macedo',names)
    def test_alias_duplicate_indicator_keeps_distinct_ids_until_confirmation(self):
        self.admin();a=self.create('Nome histórico sem equivalência');self.page.evaluate("""async id=>{const p=(await IASDPISchedules.request('iasdpi_registry_people',{p_search:''})).find(p=>p.id===id);await IASDPISchedules.request('iasdpi_registry_save',{p_person:id,p_expected_person_version:p.version,p_person_patch:{name:'Nome novo sem equivalência'},p_links:[],p_request_id:crypto.randomUUID()});}""",a);b=self.create('Nome histórico sem equivalência');self.registry();self.page.locator('.registry-identities summary').click();self.assertIn('Possíveis homônimos',self.page.locator('.registry-identities').inner_text());c=self.catalog();self.assertTrue(any(p['id']==a for p in c['people']));self.assertTrue(any(p['id']==b for p in c['people']))
    def test_failed_reconciliation_keeps_both_people_and_can_retry(self):
        self.admin();self.registry();p=self.create('Paulito');self.refresh();self.page.locator('.registry-identities summary').click();g=self.page.locator('[data-identity-group="Paulo Scarpelini"]');self.page.evaluate("()=>{window.previousIdentityRequest=IASDPISchedulePreview.request;IASDPISchedulePreview.request=(n,b)=>n==='iasdpi_registry_identity_apply'?Promise.reject(Error('Falha fictícia de conexão')):previousIdentityRequest(n,b);}");self.page.once('dialog',lambda d:d.accept());g.locator('[data-registry-consolidate]').click();self.page.wait_for_function("()=>document.querySelector('#app [role=alert]')?.textContent.includes('Falha fictícia')");self.assertTrue(any(x['id']==p for x in self.catalog()['people']));self.page.evaluate('()=>{IASDPISchedulePreview.request=previousIdentityRequest;}');self.page.locator('.registry-identities summary').click();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-identity-group="Paulo Scarpelini"] [data-registry-consolidate]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('Consolidação confirmada')")
