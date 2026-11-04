"""G3 interativo: Chromium, Auth/RPC/Edge simulados e dados fictícios."""
import json
import shutil
import unittest
import test_alias_login_browser as g2
import test_frontend_access as base

UID=base.USER
OTHER='22222222-2222-4222-8222-222222222222'
D='a0000000-0000-4000-8000-000000000001'
E='a0000000-0000-4000-8000-000000000003'
@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class GovernanceBrowserTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    tearDown=base.FrontendAccessTests.tearDown
    choose=g2.AliasLoginBrowserTests.choose
    login_as=g2.AliasLoginBrowserTests.login_as
    def setUp(self):
        g2.AliasLoginBrowserTests.setUp(self);self.role='admin';self.calls=[];self.fail_write=False;self.readonly=False;self.catalog_denied=False
        self.page.route('**/config.js',lambda r:r.fulfill(body='window.IASDPIConfig='+json.dumps(dict(supabaseUrl='https://test.supabase.co',supabasePublishableKey='sb_publishable_test',churchIsolationEnabled=True,aliasLoginEnabled=True,governanceEnabled=True,remoteReadOnly=self.readonly))+';',content_type='text/javascript'))
    def catalog(self):
        return dict(actor_id=UID,is_admin=self.role=='admin',church_id='1a5d0000-0000-4000-8000-000000000001',departments=[dict(id=D,name='Sonoplastia',can_access=True,can_members=True,can_requests=True),dict(id=E,name='Música',can_access=False,can_members=False,can_requests=False)],users=[dict(user_id=UID,name='Operador fictício',role=self.role,status='active'),dict(user_id=OTHER,name='Líder fictício',role=None,status='active')],aliases=[dict(identifier='sonoplastia',user_id=OTHER,version=2,enabled=True)] if self.role=='admin' else [],access=[dict(department_id=D,user_id=OTHER,version=1,status='active',can_view=True,can_edit=True,can_publish=False,can_manage_members=False,can_manage_access=False,can_handle_requests=False)])
    def supabase(self,route):
        req=route.request;name=req.url.rsplit('/',1)[-1]
        if '/rest/v1/rpc/' in req.url:
            body=req.post_data_json or {};self.calls.append((name,body));
            if name=='iasdpi_governance_catalog':return route.fulfill(status=403,json={'code':'42501','message':'Acesso revogado.'}) if self.catalog_denied else route.fulfill(json=self.catalog())
            if name=='iasdpi_find_account':return route.fulfill(json=[dict(user_id='44444444-4444-4444-8444-444444444444',email='institutional@example.invalid',confirmed=True,authorized=False)])
            if name=='iasdpi_governance_history':return route.fulfill(json=[dict(actor_id=UID,created_at='2026-10-30T12:00:00Z',action='department_access_active')])
            if name=='iasdpi_access_requests':return route.fulfill(json=[dict(id=OTHER,requester_name='Solicitante fictício',identifier='sonoplastia',kind='password',message='Pedido de exemplo',created_at='2026-10-30T12:00:00Z',status='verified',version=2,verification='Verificado presencialmente',can_reset=True)])
            if name=='iasdpi_department_members':return route.fulfill(json=[dict(id=OTHER,name='Membro fictício',person_id=OTHER,version=1,active=True)])
            if name=='iasdpi_access_request_options':return route.fulfill(json=[dict(id=D,name='Sonoplastia')])
            if name in ['iasdpi_department_access_save','iasdpi_alias_save','iasdpi_identity_state_save','iasdpi_set_access','iasdpi_access_request_review','iasdpi_schedule_save']:
                if self.fail_write:return route.fulfill(status=409,json={'code':'40001','message':'Alterado em outro dispositivo.'})
                return route.fulfill(status=204)
        if name=='access-assistance':
            self.calls.append((name,req.post_data_json));return route.fulfill(json=({'code':'a'*64,'expires_at':'2026-10-30T12:15:00Z'} if req.post_data_json['action']=='issue' else {'completed':True} if req.post_data_json['action']=='complete' else {'accepted':True}))
        return g2.AliasLoginBrowserTests.supabase(self,route)
    def open_admin(self):
        self.choose();self.login_as();self.page.locator('nav [data-page=access-admin]').click();self.page.wait_for_selector('[data-gov-tab=permissions]')
    def tab(self,name):self.page.locator('.governance-tabs [data-gov-tab='+name+']').click()
    def test_granular_permission_save_and_optimistic_version(self):
        self.open_admin();self.tab('permissions');form=self.page.locator('[data-gov-form=permissions][data-version="1"]');form.locator('[name=publish]').check();form.locator('button').click();self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Alteração confirmada')")
        write=next(b for n,b in self.calls if n=='iasdpi_department_access_save');self.assertTrue(write['p_flags']['publish']);self.assertTrue(write['p_flags']['edit']);self.assertEqual(write['p_expected_version'],1);self.assertEqual(write['p_department'],D)
    def test_write_failure_preserves_unsaved_inputs(self):
        self.open_admin();self.tab('permissions');self.fail_write=True;form=self.page.locator('[data-gov-form=permissions][data-version="1"]');form.locator('[name=publish]').check();form.locator('button').click();self.page.wait_for_selector('[data-gov-error]');self.assertTrue(form.locator('[name=publish]').is_checked());self.assertIn('outro dispositivo',form.locator('[data-gov-error]').inner_text())
    def test_alias_reassignment_requires_confirmation_and_preserves_version(self):
        self.open_admin();self.tab('aliases');form=self.page.locator('[data-gov-form=alias][data-version="2"]');form.locator('[name=user]').select_option(UID);form.locator('[name=reason]').fill('Substituição de liderança confirmada');self.page.once('dialog',lambda d:d.dismiss());form.locator('button').click();self.assertFalse(any(n=='iasdpi_alias_save' for n,b in self.calls));self.page.once('dialog',lambda d:d.accept());form.locator('button').click();self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Alteração confirmada')");self.assertEqual(next(b for n,b in self.calls if n=='iasdpi_alias_save')['p_expected_version'],2)
    def test_ministerial_operator_cannot_see_global_actions_or_other_department(self):
        self.role='leader';self.open_admin();self.assertEqual(self.page.locator('[data-gov-tab=aliases]').count(),0);self.assertEqual(self.page.locator('[data-gov-form=identity]').count(),0);self.tab('permissions');self.assertEqual(self.page.locator('[name=department] option[value="'+E+'"]').count(),0);self.assertTrue(self.page.locator('[name=access]').first.is_disabled());self.assertTrue(self.page.locator('[name=requests]').first.is_disabled())
    def test_public_assistance_request_and_no_password_or_account_resolution(self):
        self.choose();self.page.locator('[data-auth-page=access-request]').click();self.page.wait_for_selector('[data-gov-form=request]');form=self.page.locator('[data-gov-form=request]');form.locator('[name=name]').fill('Pessoa fictícia');form.locator('[name=identifier]').fill('sonoplastia');form.locator('[name=kind]').select_option('password');form.locator('button').click();self.page.wait_for_function("()=>document.querySelector('[data-form-feedback]')?.textContent.includes('recebida')");body=next(b for n,b in self.calls if n=='access-assistance');self.assertEqual(body['kind'],'password');self.assertNotIn('password',body);self.assertEqual(self.alias_calls,[]);self.assertEqual(form.locator('input[type=password]').count(),0)
    def test_controlled_reset_link_is_removed_from_url_and_code_not_persisted(self):
        self.page.goto(self.base+'#controlled-reset/IASD_PI/'+'a'*64);self.page.wait_for_selector('[data-gov-form=reset]');self.assertTrue(self.page.url.endswith('#controlled-reset'));form=self.page.locator('[data-gov-form=reset]');form.locator('[name=password]').fill('test-new-password-123');form.locator('[name=repeat]').fill('test-new-password-123');form.locator('button').click();self.page.wait_for_function("()=>document.querySelector('[data-form-feedback]')?.textContent.includes('Senha redefinida')");body=next(b for n,b in self.calls if n=='access-assistance');self.assertEqual(body['code'],'a'*64);self.assertNotIn('a'*64,self.page.evaluate('JSON.stringify(localStorage)'));self.page.reload();self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Reabra o link')")
    def test_reset_issue_is_controlled_and_no_admin_secret_in_browser(self):
        self.open_admin();self.tab('requests');self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-gov-action=issue]').click();self.page.wait_for_selector('input[readonly]');self.assertIn('#controlled-reset/IASD_PI/',self.page.locator('input[readonly]').input_value());self.assertNotIn('service_role',self.page.locator('#app').inner_text());self.assertEqual(next(b for n,b in self.calls if n=='access-assistance')['version'],2)
    def test_members_and_audit_use_existing_normalized_data(self):
        self.open_admin();self.tab('members');self.page.locator('[data-gov-form=members-load] button').click();self.page.wait_for_selector('[data-gov-form=member]');f=self.page.locator('[data-gov-form=member]');f.locator('[name=active]').uncheck();f.locator('button').click();self.page.wait_for_timeout(200);write=next(b for n,b in self.calls if n=='iasdpi_schedule_save');self.assertEqual(write['p_entity'],'membership');self.assertFalse(write['p_data']['active']);self.tab('history');self.assertIn('department_access_active',self.page.locator('#app').inner_text())
    def test_remote_readonly_blocks_write_but_keeps_inputs(self):
        self.readonly=True;self.open_admin();self.tab('permissions');form=self.page.locator('[data-gov-form=permissions][data-version="1"]');form.locator('[name=publish]').check();form.locator('button').click();self.page.wait_for_selector('[data-gov-error]');self.assertTrue(form.locator('[name=publish]').is_checked());self.assertFalse(any(n=='iasdpi_department_access_save' for n,b in self.calls))
    def test_layout_keyboard_and_local_data_preservation(self):
        self.open_admin();self.tab('permissions')
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('[data-gov-tab=requests]').focus();self.page.keyboard.press('Enter');self.assertIn('Solicitante fictício',self.page.locator('#app').inner_text());self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        (base.ROOT/'dist/access-governance').mkdir(parents=True,exist_ok=True)
        self.page.set_viewport_size(dict(width=390,height=900));self.page.screenshot(path=str(base.ROOT/'dist/access-governance/g3-mobile.png'),full_page=True)
        self.page.set_viewport_size(dict(width=1440,height=1000));self.page.screenshot(path=str(base.ROOT/'dist/access-governance/g3-desktop.png'),full_page=True)

    def test_revocation_clears_previously_loaded_private_catalog(self):
        self.open_admin();self.assertIn('Líder fictício',self.page.locator('#app').inner_text());self.catalog_denied=True
        self.page.evaluate("window.dispatchEvent(new Event('iasdpi-auth-changed'))")
        self.page.wait_for_selector('[data-gov-form=login]');self.assertNotIn('Líder fictício',self.page.locator('#app').inner_text());self.assertIn('Acesso revogado',self.page.locator('#app').inner_text())

    def test_create_department_access_from_existing_account_without_global_promotion(self):
        self.open_admin();form=self.page.locator('[data-gov-form=find]');form.locator('[name=email]').fill('institutional@example.invalid');form.locator('button').click()
        self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Nenhum acesso foi concedido')")
        self.assertFalse(any(n=='iasdpi_set_access' for n,b in self.calls));self.tab('permissions');self.page.locator('summary').filter(has_text='Conceder acesso').click()
        permission=self.page.locator('[data-gov-form=permissions][data-version="0"]');permission.locator('[name=user]').select_option('44444444-4444-4444-8444-444444444444');permission.locator('[name=view]').check();permission.locator('button').click()
        self.page.wait_for_function("()=>document.querySelector('#app').textContent.includes('Alteração confirmada')");write=next(b for n,b in self.calls if n=='iasdpi_department_access_save');self.assertEqual(write['p_user'],'44444444-4444-4444-8444-444444444444');self.assertFalse(write['p_flags']['edit']);self.assertFalse(any(n=='iasdpi_set_access' for n,b in self.calls))
