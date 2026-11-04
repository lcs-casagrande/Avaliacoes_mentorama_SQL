"""Browser com Auth/Edge interceptados, sem contas reais ou acesso ao Supabase."""
import base64
from datetime import datetime,timezone
import json
import shutil
import unittest
import test_frontend_access as base
import test_church_selection as g1

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class AliasLoginBrowserTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    tearDown=base.FrontendAccessTests.tearDown
    def setUp(self):
        base.FrontendAccessTests.setUp(self);self.alias_calls=[];self.email_calls=0;self.mode='success'
        self.page.route('**/config.js',lambda r:r.fulfill(body="window.IASDPIConfig={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_test',churchIsolationEnabled:true,aliasLoginEnabled:true};",content_type='text/javascript'))
    def supabase(self,route):
        req=route.request
        if req.url.endswith('/rpc/iasdpi_list_churches'):return route.fulfill(json=[{'id':'1a5d0000-0000-4000-8000-000000000001','code':'IASD_PI','name':'IASD Parada Inglesa'}])
        if req.url.endswith('/functions/v1/alias-login'):
            self.alias_calls.append(req.post_data_json)
            if self.mode!='success':return route.fulfill(status=401,json={'error':'DETAILS MUST NOT BE REFLECTED '+self.mode+' private@example.invalid'})
            enc=lambda v:base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
            token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':base.USER,'exp':int(datetime.now(timezone.utc).timestamp())+3600,'iat':int(datetime.now(timezone.utc).timestamp()),'role':'authenticated','iss':'https://test.supabase.co/auth/v1','aud':'authenticated'})+'.test-signature-only'
            return route.fulfill(json={'access_token':token,'refresh_token':'alias-refresh-test-only'})
        if '/token?grant_type=password' in req.url:self.email_calls+=1
        return base.FrontendAccessTests.supabase(self,route)
    def choose(self):
        self.page.goto(self.base+'#login');self.page.wait_for_selector('#church-select');self.page.locator('#church-select').select_option('IASD_PI');self.page.wait_for_selector('#auth-login-form')
    def login_as(self,identifier='sonoplastia'):
        self.page.locator('#auth-login-form [name=email]').fill(identifier);self.page.locator('#auth-login-form [name=password]').fill('individual-test-password');self.page.locator('#auth-login-form button').click();self.page.wait_for_function('()=>IASDPIAuth.allowed()')
    def test_identifier_field_and_church_then_native_sdk_session(self):
        self.choose();self.assertEqual(self.page.locator('[name=email]').get_attribute('type'),'text');self.assertIn('Identificador ou e-mail',self.page.locator('#auth-login-form').inner_text());self.login_as()
        self.assertEqual(self.email_calls,0);self.assertEqual(self.alias_calls,[{'church':'IASD_PI','identifier':'sonoplastia','password':'individual-test-password'}]);self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'))
        saved=self.page.evaluate('JSON.parse(localStorage.getItem(IASDPIStorage.authSession))');self.assertEqual(saved['user']['id'],base.USER);self.assertNotIn('individual-test-password',json.dumps(saved))
    def test_institutional_administrator_alias_does_not_promote_leader(self):
        self.choose();self.login_as('administrador');self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'))
        self.page.evaluate("()=>IASDPIAuth.login('musica','individual-test-password')");self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'));self.assertEqual(self.page.evaluate('IASDPIAuth.session().user.id'),base.USER)
        self.assertEqual([c['identifier'] for c in self.alias_calls],['administrador','musica'])
    def test_existing_email_login_bypasses_alias_endpoint(self):
        self.choose();self.login_as('test@example.invalid');self.assertEqual(self.email_calls,1);self.assertEqual(self.alias_calls,[])
    def test_unknown_disabled_wrong_password_and_limits_have_identical_public_errors(self):
        self.choose();messages=[]
        for self.mode in ['unknown','disabled','wrong-password','limited']:
            messages.append(self.page.evaluate("async()=>{try{await IASDPIAuth.login('sonoplastia','individual-test-password');return 'unexpected';}catch(e){return e.message;}}"));self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(len(set(messages)),1);self.assertNotIn('@',messages[0]);self.assertNotIn('DETAILS',messages[0]);self.assertNotIn('individual-test-password',self.page.evaluate('JSON.stringify(localStorage)'))
    def test_reload_keeps_native_session_without_resolving_alias_again(self):
        self.choose();self.login_as();self.page.reload();self.page.wait_for_function('()=>IASDPIAuth.allowed()');self.assertEqual(len(self.alias_calls),1);self.assertEqual(self.page.evaluate('IASDPIChurches.selected()'),'IASD_PI')
    def test_email_recovery_form_kept_without_public_alias_resolution(self):
        self.choose();self.page.get_by_text('Esqueci minha senha',exact=True).click();self.page.wait_for_selector('#password-request-form');self.assertEqual(self.page.locator('#password-request-form [name=email]').get_attribute('type'),'email');self.assertEqual(self.alias_calls,[])
    def test_new_login_layout_mobile_and_preserves_existing_local_records(self):
        self.choose()
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size(dict(width=width,height=900));self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        self.page.set_viewport_size(dict(width=390,height=900));self.page.screenshot(path=str(base.ROOT/'dist/alias-login/login-mobile.png'),full_page=True)
