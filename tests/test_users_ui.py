"""Interface de administração/convites com Supabase simulado, em perfil isolado."""
import json
import shutil
import unittest
import test_frontend_access as base


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Playwright e Chromium')
class UsersUITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base.FrontendAccessTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        base.FrontendAccessTests.tearDownClass.__func__(cls)

    def setUp(self):
        base.FrontendAccessTests.setUp(self)
        self.role = 'admin'
        self.calls = []
        self.members = [
            {'user_id': base.USER, 'email': 'test@example.invalid', 'role': 'admin', 'enabled': True},
            {'user_id': '22222222-2222-4222-8222-222222222222', 'email': 'leader@example.invalid', 'role': 'leader', 'enabled': True}]
        self.invites = []

    tearDown = base.FrontendAccessTests.tearDown
    open = base.FrontendAccessTests.open
    login = base.FrontendAccessTests.login

    def supabase(self, route):
        url = route.request.url
        if '/rpc/' in url:
            name = url.split('/rpc/')[1]
            body = json.loads(route.request.post_data or '{}')
            self.calls.append((name, body))
            if name == 'iasdpi_accept_invite':
                if body.get('p_token') != 'a' * 64:
                    route.fulfill(status=403, json={'code': '42501', 'message': 'Convite inválido ou indisponível.'})
                else:
                    self.role = 'leader'
                    route.fulfill(status=204)
            elif self.role != 'admin':
                route.fulfill(status=403, json={'code': '42501', 'message': 'Acesso administrativo necessário.'})
            elif name == 'iasdpi_list_users':
                route.fulfill(json=self.members)
            elif name == 'iasdpi_list_invites':
                route.fulfill(json=self.invites)
            elif name == 'iasdpi_find_account':
                route.fulfill(json=[{'user_id': '44444444-4444-4444-8444-444444444444', 'email': body['p_email'], 'confirmed': True, 'authorized': False}])
            elif name == 'iasdpi_set_access':
                if body['p_user_id'] == base.USER and (body['p_role'] != 'admin' or not body['p_enabled']):
                    route.fulfill(status=400, json={'code': '23514', 'message': 'Não é permitido remover ou rebaixar o último administrador.'})
                else:
                    for row in self.members:
                        if row['user_id'] == body['p_user_id']:
                            row.update(role=body['p_role'], enabled=body['p_enabled'])
                            break
                    else:
                        self.members.append({'user_id': body['p_user_id'], 'email': 'new@example.invalid', 'role': body['p_role'], 'enabled': body['p_enabled']})
                    route.fulfill(status=204)
            elif name == 'iasdpi_create_invite':
                item = {'id': 'invite-test', 'email': body['p_email'], 'created_at': '2026-10-21T12:00:00Z', 'expires_at': '2026-10-23T12:00:00Z'}
                self.invites = [item]
                route.fulfill(json=[dict(item, token='a' * 64)])
            elif name == 'iasdpi_revoke_invite':
                self.invites = []
                route.fulfill(status=204)
            else:
                route.fulfill(status=404, json={})
        elif '/auth/v1/signup' in url:
            route.fulfill(json={'user': {'id': base.USER}})
        else:
            base.FrontendAccessTests.supabase(self, route)

    def open_admin(self):
        self.open()
        self.login()
        self.page.wait_for_function('IASDPIAuth.isAdmin()')
        self.page.locator('nav [data-page="users"]').click()
        self.page.wait_for_selector('.user-access-form')

    def test_admin_can_list_promote_revoke_and_authorize_exact_account(self):
        self.open_admin()
        row = self.page.locator('.user-access-form').nth(1)
        row.locator('[name="role"]').select_option('admin')
        row.locator('button').click()
        self.page.wait_for_function('!state.busy')
        self.assertEqual(self.members[1]['role'], 'admin')
        row = self.page.locator('.user-access-form').nth(1)
        row.locator('[name="enabled"]').uncheck()
        row.locator('button').click()
        self.page.wait_for_function('!state.busy')
        self.assertFalse(self.members[1]['enabled'])
        self.page.locator('#users-find-form [name="email"]').fill('new@example.invalid')
        self.page.locator('#users-find-form button').click()
        self.page.locator('[data-action="users-authorize"]').click()
        self.page.wait_for_function('!state.busy')
        self.assertEqual(self.members[-1]['role'], 'leader')

    def test_last_admin_error_is_visible_without_changing_records(self):
        self.open_admin()
        row = self.page.locator('.user-access-form').first
        row.locator('[name="enabled"]').uncheck()
        row.locator('button').click()
        self.page.wait_for_function('!state.busy')
        self.assertIn('último administrador', self.page.locator('#notice').inner_text())
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"), self.raw)

    def test_leader_cannot_open_admin_or_call_frontend_rpc(self):
        self.role = 'leader'
        self.open()
        self.login()
        self.page.wait_for_function('IASDPIAuth.allowed()')
        self.assertFalse(self.page.locator('nav [data-page="users"]').is_visible())
        self.page.evaluate("navigate('users')")
        self.assertEqual(self.page.locator('#users-find-form').count(), 0)
        denied = self.page.evaluate("async()=>{try{await usersRpc('iasdpi_list_users');return false;}catch(_){return true;}}")
        self.assertTrue(denied)
        self.assertEqual(self.calls, [])

    def test_admin_invite_link_and_revocation(self):
        self.open_admin()
        self.page.locator('#users-invite-form [name="email"]').fill('new@example.invalid')
        self.page.locator('#users-invite-form button').click()
        self.page.wait_for_selector('#users-invite-link')
        self.assertTrue(self.page.locator('#users-invite-link').input_value().endswith('#invite/' + 'a' * 64))
        self.assertNotIn('a' * 64, self.page.evaluate('JSON.stringify(localStorage)'))
        self.page.locator('[data-action="users-revoke-invite"]').click()
        self.page.wait_for_function('!state.busy')
        self.assertEqual(self.invites, [])

    def test_invitee_can_accept_before_being_authorized(self):
        self.role = ''
        self.open('#invite/' + 'a' * 64)
        self.assertTrue(self.page.url.endswith('#invite'))
        self.page.locator('#invite-login-form [name="email"]').fill('test@example.invalid')
        self.page.locator('#invite-login-form [name="password"]').fill('correct-password')
        self.page.locator('#invite-login-form button').click()
        self.page.wait_for_function('IASDPIAuth.allowed() && state.programs.length===1')
        self.assertFalse(self.page.evaluate('IASDPIAuth.isAdmin()'))
        self.assertIn(('iasdpi_accept_invite', {'p_token': 'a' * 64}), self.calls)

    def test_signup_does_not_grant_access_or_store_password(self):
        self.role = ''
        self.open('#invite/' + 'a' * 64)
        self.page.locator('#invite-signup-form [name="email"]').fill('new@example.invalid')
        self.page.locator('#invite-signup-form [name="password"]').fill('new-secure-password')
        self.page.locator('#invite-signup-form button').click()
        self.page.wait_for_function('!state.busy')
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(self.calls, [])
        self.assertNotIn('new-secure-password', self.page.evaluate('JSON.stringify(localStorage)'))

    def test_demotion_clears_admin_list_and_mobile_has_no_overflow(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open_admin()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.role = 'leader'
        self.page.evaluate('async()=>{await IASDPIAuth.requireAccess();}')
        self.assertEqual(self.page.evaluate('usersState.rows.length'), 0)
        self.assertFalse(self.page.locator('nav [data-page="users"]').is_visible())

    def test_confirmation_callback_does_not_import_or_keep_tokens(self):
        self.role = ''
        self.open('#access_token=example-callback-token&refresh_token=example-refresh')
        self.assertTrue(self.page.url.endswith('#organization'))
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertNotIn('example-callback-token', self.page.evaluate('JSON.stringify(localStorage)'))


if __name__ == '__main__':
    unittest.main()
