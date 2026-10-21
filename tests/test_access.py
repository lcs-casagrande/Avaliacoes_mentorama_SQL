"""Sem produção: JWT/Supabase simulados; SQLite exclusivamente temporário."""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import access_control
import server

USER = '11111111-1111-4111-8111-111111111111'
ENV = {'SUPABASE_URL': 'https://example.supabase.co',
       'SUPABASE_PUBLISHABLE_KEY': 'public-test-key'}


def user():
    return {'id': USER, 'is_anonymous': False,
            'user_metadata': {'role': 'admin'}}


def membership(role='leader', enabled=True):
    return [{'user_id': USER, 'role': role, 'enabled': enabled}]


class AuthorizationTests(unittest.TestCase):
    def check_denied(self, replies, status=403):
        with patch.dict(os.environ, ENV), patch.object(access_control, '_get', side_effect=replies):
            with self.assertRaises(access_control.AccessDenied) as error:
                access_control.authorize({'Authorization': 'Bearer test.token'})
            self.assertEqual(error.exception.status, status)

    def test_no_token_does_not_contact_supabase(self):
        with patch.object(access_control, '_get') as remote:
            with self.assertRaises(access_control.AccessDenied) as error:
                access_control.authorize({})
            self.assertEqual(error.exception.status, 401)
            remote.assert_not_called()

    def test_admin_and_leader(self):
        for role in ('admin', 'leader'):
            with patch.dict(os.environ, ENV), patch.object(access_control, '_get', side_effect=[user(), membership(role)]):
                self.assertEqual(access_control.authorize({'Authorization': 'Bearer test.token'})['role'], role)

    def test_metadata_cannot_self_promote(self):
        self.check_denied([user(), []])

    def test_disabled_unknown_or_wrong_user(self):
        for rows in (membership(enabled=False), membership('member'),
                     [{'user_id': 'other', 'role': 'admin', 'enabled': True}], {}, [None]):
            self.check_denied([user(), rows])

    def test_anonymous_account(self):
        self.check_denied([{'id': USER, 'is_anonymous': True}])

    def test_missing_configuration(self):
        with patch.dict(os.environ, {'SUPABASE_URL': '', 'SUPABASE_PUBLISHABLE_KEY': ''}):
            with self.assertRaises(access_control.AccessDenied) as error:
                access_control.authorize({'Authorization': 'Bearer test.token'})
            self.assertEqual(error.exception.status, 503)

    def test_invalid_token_and_network_fail_closed(self):
        for error, status in ((HTTPError('https://example.supabase.co', 401, '', {}, None), 401),
                              (URLError('offline'), 503)):
            with patch.object(access_control, 'urlopen', side_effect=error):
                with self.assertRaises(access_control.AccessDenied) as caught:
                    access_control._get('https://example.supabase.co/auth/v1/user', 'key', 'token')
                self.assertEqual(caught.exception.status, status)

    def test_project_url_rejects_credentials_and_header_injection(self):
        for value in ('https://user:pass@example.supabase.co', 'https://example.supabase.co/path',
                      'https://example.supabase.co\r\nX-Test: yes', 'http://example.supabase.co'):
            with patch.dict(os.environ, {'SUPABASE_URL': value}):
                self.assertEqual(access_control.project_url(), '')


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='iasdpi-tests-')
        cls.old_db = server.DB_PATH
        server.DB_PATH = Path(cls.directory.name) / 'test.sqlite3'
        server.initialize()
        cls.server = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        server.DB_PATH = cls.old_db
        cls.directory.cleanup()

    def request(self, path, method='GET', body=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        request = Request(self.base + path, method=method, headers=headers,
                          data=json.dumps(body).encode() if body is not None else None)
        try:
            response = urlopen(request)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read(), response.headers

    def test_public_files_and_health(self):
        with patch.object(server, 'database', side_effect=AssertionError('SQLite acessado')):
            for path in ('/', '/organization.js', '/agenda.js', '/auth.js', '/api/health'):
                self.assertEqual(self.request(path)[0], 200)

    def test_every_private_route_denies_before_database(self):
        routes = [('GET', '/api/programs'), ('GET', '/api/programs/x'),
                  ('POST', '/api/programs'), ('PUT', '/api/programs/x'),
                  ('POST', '/api/programs/x/action'), ('PUT', '/api/programs/x/actuals'),
                  ('PUT', '/api/programs/x/notes'), ('POST', '/api/programs/x/duplicate'),
                  ('GET', '/api/chronogram')]
        with patch.object(server, 'database', side_effect=AssertionError('SQLite acessado')):
            for method, path in routes:
                self.assertEqual(self.request(path, method, {})[0], 401, path)

    def test_private_files_cannot_be_downloaded(self):
        for path in ('/backend/chronogram.json', '/chronogram.json', '/data/iasdpi.sqlite3', '/access_control.py'):
            self.assertEqual(self.request(path)[0], 404)

    def test_rejected_role_cannot_read_or_write(self):
        with patch.dict(os.environ, ENV), patch.object(access_control, '_get', side_effect=lambda url, *_: user() if '/auth/' in url else []), patch.object(server, 'database', side_effect=AssertionError('SQLite acessado')):
            for method in ('GET', 'POST'):
                self.assertEqual(self.request('/api/programs', method, {}, 'valid.token')[0], 403)

    def test_allowed_workflow_and_revocation(self):
        remote = lambda url, *_: user() if '/auth/' in url else membership()
        with patch.dict(os.environ, ENV), patch.object(access_control, '_get', side_effect=remote):
            status, raw, _ = self.request('/api/chronogram', token='valid.token')
            self.assertEqual(status, 200)
            plan = json.loads(raw)
            status, raw, _ = self.request('/api/programs', 'POST', plan, 'valid.token')
            self.assertEqual(status, 200)
            program = json.loads(raw)
            first = plan['items'][0]['id']
            records = {item['id']: {'start': '', 'end': ''} for item in plan['items']}
            records[first] = {'start': '09:32:18', 'end': '09:37:16', 'note': 'Preservar'}
            extra = {'id': 'extra-test', 'position': 1, 'activity': 'Extra', 'start': '09:37:16', 'end': '09:37:30', 'note': '', 'responsible': ''}
            status, raw, _ = self.request('/api/programs/' + program['id'] + '/actuals', 'PUT',
                                         {'version': program['version'], 'executions': records, 'extra_events': [extra]}, 'valid.token')
            self.assertEqual(status, 200)
            saved = json.loads(raw)
            self.assertEqual(saved['extra_events'][0]['id'], 'extra-test')
            self.assertIn('09:32:18', saved['executions'][first]['started'])
        with patch.dict(os.environ, ENV), patch.object(access_control, '_get', side_effect=[user(), membership(enabled=False)]):
            self.assertEqual(self.request('/api/programs', token='valid.token')[0], 403)

    def test_csp_allows_only_configured_project(self):
        with patch.dict(os.environ, ENV):
            policy = self.request('/')[2]['Content-Security-Policy']
            self.assertIn("connect-src 'self' https://example.supabase.co;", policy)
            self.assertNotIn('unsafe-inline', policy)


if __name__ == '__main__':
    unittest.main()
