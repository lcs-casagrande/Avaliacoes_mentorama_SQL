"""Seletor anterior ao Auth, rede interceptada e dados descartáveis."""
import json
import shutil
import unittest
from unittest.mock import patch
import test_frontend_access as base

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class ChurchSelectionTests(base.FrontendAccessTests):
    def setUp(self):
        super().setUp();self.list_status=200;self.churches=[{'id':'1a5d0000-0000-4000-8000-000000000001','code':'IASD_PI','name':'IASD Parada Inglesa'}];self.rest_headers=[];self.auth_password_requests=0
        self.page.route('**/config.js',lambda r:r.fulfill(body="window.IASDPIConfig={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_test',churchIsolationEnabled:true};",content_type='text/javascript'))
    def supabase(self,route):
        request=route.request
        if request.url.endswith('/rpc/iasdpi_list_churches'):
            route.fulfill(status=self.list_status,json=self.churches if self.list_status==200 else {'message':'indisponível'});return
        if '/rest/v1/' in request.url:self.rest_headers.append(request.headers.get('x-iasdpi-church'))
        if 'grant_type=password' in request.url:self.auth_password_requests+=1
        return super().supabase(route)
    def choose(self):
        self.page.goto(self.base+'#login');self.page.wait_for_selector('#church-select');self.page.locator('#church-select').select_option('IASD_PI');self.page.get_by_role('button',name='Continuar',exact=True).click();self.page.wait_for_selector('#auth-login-form')
    def test_selector_precedes_password_and_only_backend_list_is_used(self):
        self.page.goto(self.base+'#login');self.page.wait_for_selector('#church-select');self.assertEqual(self.page.locator('input[type=password]').count(),0)
        self.assertNotIn('Carregando igrejas',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('#church-select option:not([value=""])').all_text_contents(),['IASD Parada Inglesa']);self.assertEqual(self.auth_password_requests,0)
        self.page.evaluate("document.querySelector('#church-select').innerHTML+='<option value=FORGED>Igreja indevida</option>';document.querySelector('#church-select').value='FORGED'")
        self.page.get_by_role('button',name='Continuar',exact=True).click();self.assertEqual(self.page.locator('input[type=password]').count(),0);self.assertEqual(self.page.evaluate('IASDPIChurches.selected()'),'')
    def test_selected_church_survives_reload_and_all_rest_requests_are_scoped(self):
        self.choose();self.login();self.page.wait_for_function("()=>IASDPIAuth.allowed()");self.assertGreater(self.auth_password_requests,0);self.assertTrue(self.rest_headers);self.assertTrue(all(v=='IASD_PI' for v in self.rest_headers))
        self.page.reload();self.page.wait_for_selector('#app');self.assertEqual(self.page.evaluate('IASDPIChurches.selected()'),'IASD_PI')
    def test_temporary_listing_failure_is_error_and_retry_recovers(self):
        self.list_status=503;self.page.goto(self.base+'#login');self.page.wait_for_selector('[data-church-retry]');self.assertEqual(self.page.locator('#church-select').count(),0);self.assertIn('indisponível',self.page.locator('[role=alert]').inner_text())
        self.list_status=200;self.page.get_by_role('button',name='Tentar novamente',exact=True).click();self.page.wait_for_selector('#church-select');self.assertEqual(self.auth_password_requests,0)
    def test_really_empty_list_and_invalid_saved_choice_never_fall_back(self):
        self.churches=[];self.page.goto(self.base+'#login');self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Nenhuma igreja')");self.assertEqual(self.page.locator('input[type=password],#church-select').count(),0)
        self.churches=[{'id':'1','code':'IASD_PI','name':'IASD Parada Inglesa'}];self.page.evaluate("sessionStorage.setItem('iasdpi-selected-church-v1','UNAUTHORIZED')");self.page.reload();self.page.wait_for_selector('#church-select');self.assertEqual(self.page.locator('input[type=password]').count(),0)
    def test_original_local_keys_preserved_and_future_scopes_separate(self):
        self.choose();self.assertEqual(self.page.evaluate('IASDPIStorage.programs'),'iasdpi-demo-v1');self.assertEqual(self.page.evaluate("IASDPIStorage.scope('iasdpi-edit-drafts-v1')"),'iasdpi-edit-drafts-v1')
        self.page.evaluate("sessionStorage.setItem('iasdpi-selected-church-v1','TEST_ONLY')")
        self.assertEqual(self.page.evaluate("IASDPIChurches.storageScope('iasdpi-demo-v1')"),'church:TEST_ONLY:iasdpi-demo-v1');self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
    def test_selector_keyboard_and_mobile(self):
        self.page.goto(self.base+'#login');self.page.wait_for_selector('#church-select')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.assertGreaterEqual(self.page.locator('#church-select').bounding_box()['height'],44)
        self.page.locator('#church-select').focus();self.page.keyboard.press('ArrowDown');self.page.keyboard.press('Tab');self.assertTrue(self.page.get_by_role('button',name='Continuar',exact=True).evaluate('e=>e===document.activeElement'))
    # Os cenários herdados são cobertos na classe original, com feature desativada.
    test_public_pages_and_direct_access_preserve_storage=None
    test_leader_can_edit_and_logout_keeps_original_records=None
    test_auth_metadata_does_not_grant_access=None
    test_revocation_blocks_next_operation_and_hides_loaded_data=None
    test_session_expiry_hides_private_content=None
    test_admin_and_mobile_navigation=None
    test_new_manual_record_loads_protected_template=None
    test_wrong_password_cannot_load_saved_records=None
    test_authorized_backup_roundtrip_preserves_data=None

class LegacyBackendChurchTests(unittest.TestCase):
    def test_non_original_church_is_denied_before_remote_or_sqlite(self):
        import sys
        sys.path.insert(0,str(base.ROOT/'backend'))
        import access_control
        with patch.object(access_control,'_get') as remote:
            with self.assertRaises(access_control.AccessDenied) as failure:access_control.authorize({'Authorization':'Bearer test.token','X-IASDPI-Church':'OTHER'})
            self.assertEqual(failure.exception.status,403);remote.assert_not_called()

class ChurchPackageTests(unittest.TestCase):
    def test_new_manifest_requires_church_module_even_if_removed_from_inventory(self):
        import tempfile
        from pathlib import Path
        from test_pages_release import builder
        with tempfile.TemporaryDirectory() as tmp:
            site=Path(tmp)/'site';manifest=builder.build(site);self.assertEqual(manifest['manifest_version'],6);self.assertIn('churches.js',manifest['files']);builder.validate_package(site)
            del manifest['files']['churches.js'];(site/'churches.js').unlink();(site/'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'obrigatório ausente'):builder.validate_package(site)
    def test_previous_v3_package_still_valid_and_rollback_does_not_require_new_module(self):
        import tempfile
        from pathlib import Path
        from test_pages_release import builder
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);old=root/'old';manifest=builder.build(old);manifest['manifest_version']=3;manifest['files'].pop('governance.js');(old/'governance.js').unlink();del manifest['files']['churches.js'];(old/'churches.js').unlink();(old/'manifest.json').write_text(json.dumps(manifest))
            builder.validate_package(old);current=root/'current';builder.build(current,previous_site=old);rollback=root/'rollback';builder.build_rollback(rollback,old,current)
            self.assertEqual(builder.validate_package(rollback)['manifest_version'],3);self.assertEqual((old/'index.html').read_bytes(),(rollback/'index.html').read_bytes())
