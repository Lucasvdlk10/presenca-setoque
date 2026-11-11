import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import api

UI_ORIGIN = 'http://127.0.0.1:5173'


class AuthApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.original_db = api.DB
        api.DB = Path(cls.temp.name) / 'auth-test.sqlite3'
        api.init_db()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        api.DB = cls.original_db
        cls.temp.cleanup()

    def setUp(self):
        with api.transaction() as conn:
            conn.execute('DELETE FROM auth_sessions')
            conn.execute('DELETE FROM auth_users')
            conn.execute('DELETE FROM attendance')
            conn.execute('DELETE FROM participant_photos')
            conn.execute('DELETE FROM participants')
        with api.LOGIN_LOCK:
            api.LOGIN_ATTEMPTS.clear()

    def request_json(self, path, payload=None, method=None, cookie=None, origin=UI_ORIGIN):
        data = None if payload is None else json.dumps(payload).encode()
        headers = {}
        if origin is not None:
            headers['Origin'] = origin
        if data is not None:
            headers['Content-Type'] = 'application/json'
        if cookie:
            headers['Cookie'] = cookie
        request = urllib.request.Request(
            self.base + path, data=data, headers=headers,
            method=method or ('POST' if data is not None else 'GET'),
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response), response.headers
        except urllib.error.HTTPError as error:
            try:
                return error.code, json.load(error), error.headers
            finally:
                error.close()

    def create_account(self):
        password = 'synthetic testing passphrase with digits 2026'
        status, body, headers = self.request_json(
            '/api/auth/setup',
            {'username': 'fixtureadmin', 'display_name': 'Admin Fixture', 'password': password},
            'POST',
        )
        self.assertEqual(status, 201, body)
        return password, headers.get('Set-Cookie', '').split(';', 1)[0], body['profile']

    def test_auth_status_reports_first_run_without_exposing_credentials(self):
        status, body, _ = self.request_json('/api/auth/status')
        self.assertEqual(status, 200)
        self.assertEqual(body, {'setup_required': True, 'authenticated': False})
        health_status, health, _ = self.request_json('/api/health')
        self.assertEqual(health_status, 200)
        self.assertTrue(health['ok'])

    def test_first_setup_creates_one_profile_and_hashed_password(self):
        password = 'synthetic testing passphrase with digits 2026'
        status, body, headers = self.request_json(
            '/api/auth/setup',
            {'username': 'fixtureadmin', 'display_name': 'Admin Fixture', 'password': password},
            'POST',
        )
        self.assertEqual(status, 201, body)
        expected_profile = {'username': 'fixtureadmin', 'display_name': 'Admin Fixture'}
        self.assertEqual(body, {'ok': True, 'profile': expected_profile})
        set_cookie = headers.get('Set-Cookie', '')
        for attribute in ('__Host-presence_session=', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'):
            self.assertIn(attribute, set_cookie)
        self.assertNotIn('Domain=', set_cookie)
        cookie = set_cookie.split(';', 1)[0]
        status, state, _ = self.request_json('/api/auth/status', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(state, {'setup_required': False, 'authenticated': True, 'profile': expected_profile})
        status, profile_body, _ = self.request_json('/api/auth/profile', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(profile_body, {'profile': expected_profile})
        status, people, _ = self.request_json('/api/participants', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(people, [])
        with api.transaction() as conn:
            user = conn.execute('SELECT username,display_name,password_salt,password_hash,password_iterations FROM auth_users').fetchone()
            self.assertIsNotNone(user)
            self.assertEqual(user['username'], 'fixtureadmin')
            self.assertEqual(user['display_name'], 'Admin Fixture')
            self.assertNotEqual(user['password_hash'], password)
            self.assertNotIn(password, str(tuple(user)))
            self.assertEqual(user['password_iterations'], api.AUTH_ITERATIONS)
            self.assertEqual(conn.execute('SELECT count(*) FROM auth_sessions').fetchone()[0], 1)
            session_hash = conn.execute('SELECT token_hash FROM auth_sessions').fetchone()[0]
            self.assertEqual(len(session_hash), 64)
            self.assertNotEqual(session_hash, cookie.partition('=')[2])

    def test_login_verifies_password_and_issues_session_cookie(self):
        password, _, expected_profile = self.create_account()
        status, body, _ = self.request_json(
            '/api/auth/login',
            {'username': 'fixtureadmin', 'password': 'wrong synthetic passphrase 2026'},
            'POST',
        )
        self.assertEqual(status, 401)
        self.assertEqual(body, {'error': 'Usuário ou senha inválidos.'})
        status, body, headers = self.request_json(
            '/api/auth/login',
            {'username': 'FIXTUREADMIN', 'password': password},
            'POST',
        )
        self.assertEqual(status, 200, body)
        self.assertEqual(body, {'ok': True, 'profile': expected_profile})
        set_cookie = headers.get('Set-Cookie', '')
        self.assertIn('__Host-presence_session=', set_cookie)
        self.assertIn('HttpOnly', set_cookie)
        self.assertIn('Secure', set_cookie)
        cookie = set_cookie.split(';', 1)[0]
        status, state, _ = self.request_json('/api/auth/status', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(state, {'setup_required': False, 'authenticated': True, 'profile': expected_profile})

    def test_logout_revokes_session_and_clears_cookie(self):
        _, cookie, _ = self.create_account()
        status, body, headers = self.request_json('/api/auth/logout', method='POST', cookie=cookie)
        self.assertEqual(status, 200, body)
        self.assertEqual(body, {'ok': True})
        cleared = headers.get('Set-Cookie', '')
        self.assertIn('__Host-presence_session=', cleared)
        self.assertIn('Max-Age=0', cleared)
        self.assertIn('HttpOnly', cleared)
        status, state, _ = self.request_json('/api/auth/status', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(state, {'setup_required': False, 'authenticated': False})
        status, _, _ = self.request_json('/api/participants', cookie=cookie)
        self.assertEqual(status, 401)

    def test_profile_edit_changes_display_name_and_login_username(self):
        password, cookie, _ = self.create_account()
        expected_profile = {'username': 'newadmin', 'display_name': 'Nome Atualizado'}
        status, body, _ = self.request_json(
            '/api/auth/profile', expected_profile, 'POST', cookie=cookie,
        )
        self.assertEqual(status, 200, body)
        self.assertEqual(body, {'ok': True, 'profile': expected_profile})
        status, state, _ = self.request_json('/api/auth/status', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(state, {'setup_required': False, 'authenticated': True, 'profile': expected_profile})
        status, body, headers = self.request_json(
            '/api/auth/login', {'username': 'newadmin', 'password': password}, 'POST',
        )
        self.assertEqual(status, 200, body)
        self.assertEqual(body['profile'], expected_profile)
        self.assertIn('__Host-presence_session=', headers.get('Set-Cookie', ''))

    def test_password_change_verifies_current_password_and_rotates_all_sessions(self):
        old_password, first_cookie, profile = self.create_account()
        status, _, headers = self.request_json(
            '/api/auth/login', {'username': 'fixtureadmin', 'password': old_password}, 'POST',
        )
        self.assertEqual(status, 200)
        second_cookie = headers.get('Set-Cookie', '').split(';', 1)[0]
        new_password = 'another synthetic passphrase for the new account secret 2026'
        status, _, _ = self.request_json(
            '/api/auth/password', {'current_password': 'wrong current passphrase 2026', 'new_password': new_password},
            'POST', cookie=second_cookie,
        )
        self.assertEqual(status, 401)
        status, state, _ = self.request_json('/api/auth/status', cookie=second_cookie)
        self.assertTrue(state['authenticated'])
        status, body, headers = self.request_json(
            '/api/auth/password', {'current_password': old_password, 'new_password': new_password},
            'POST', cookie=second_cookie,
        )
        self.assertEqual(status, 200, body)
        self.assertEqual(body, {'ok': True, 'profile': profile})
        new_cookie = headers.get('Set-Cookie', '').split(';', 1)[0]
        self.assertIn('__Host-presence_session=', headers.get('Set-Cookie', ''))
        for stale_cookie in (first_cookie, second_cookie):
            status, _, _ = self.request_json('/api/participants', cookie=stale_cookie)
            self.assertEqual(status, 401)
        status, state, _ = self.request_json('/api/auth/status', cookie=new_cookie)
        self.assertTrue(state['authenticated'])
        status, _, _ = self.request_json('/api/auth/logout', {}, 'POST', cookie=new_cookie)
        self.assertEqual(status, 200)
        status, _, _ = self.request_json(
            '/api/auth/login', {'username': 'fixtureadmin', 'password': old_password}, 'POST',
        )
        self.assertEqual(status, 401)
        status, body, _ = self.request_json(
            '/api/auth/login', {'username': 'fixtureadmin', 'password': new_password}, 'POST',
        )
        self.assertEqual(status, 200, body)

    def test_private_read_routes_reject_requests_without_a_session(self):
        routes = [
            '/api/participants',
            '/api/summary',
            '/api/attendance?start=2026-11-02&end=2026-11-04',
            '/api/participants/111.111.111-11/photo',
            '/api/auth/profile',
        ]
        for path in routes:
            with self.subTest(path=path):
                status, _, _ = self.request_json(path)
                self.assertEqual(status, 401)

    def test_write_routes_reject_unauthenticated_requests_before_validation(self):
        requests = [
            ('/api/participants', {}, 'POST'),
            ('/api/attendance/batch', {}, 'POST'),
            ('/api/participants/111.111.111-11', {}, 'PATCH'),
            ('/api/auth/profile', {}, 'POST'),
            ('/api/auth/password', {}, 'POST'),
        ]
        for path, payload, method in requests:
            with self.subTest(path=path, method=method):
                status, _, _ = self.request_json(path, payload, method)
                self.assertEqual(status, 401)
    def test_setup_validates_passphrase_and_rejects_second_account(self):
        short = {'username': 'fixtureadmin', 'display_name': 'Admin Fixture', 'password': 'short'}
        status, _, _ = self.request_json('/api/auth/setup', short, 'POST')
        self.assertEqual(status, 400)
        status, state, _ = self.request_json('/api/auth/status')
        self.assertEqual(state, {'setup_required': True, 'authenticated': False})
        self.create_account()
        second = {'username': 'secondadmin', 'display_name': 'Another Admin',
                  'password': 'synthetic second administrator passphrase 2026'}
        status, _, _ = self.request_json('/api/auth/setup', second, 'POST')
        self.assertEqual(status, 409)
        with api.transaction() as conn:
            self.assertEqual(conn.execute('SELECT count(*) FROM auth_users').fetchone()[0], 1)

    def test_credentialed_cors_no_store_and_origin_guard(self):
        status, _, headers = self.request_json('/api/auth/status')
        self.assertEqual(status, 200)
        self.assertEqual(headers.get('Access-Control-Allow-Origin'), UI_ORIGIN)
        self.assertEqual(headers.get('Access-Control-Allow-Credentials'), 'true')
        self.assertEqual(headers.get('Cache-Control'), 'no-store')
        preflight = urllib.request.Request(
            self.base + '/api/auth/login',
            headers={'Origin': UI_ORIGIN, 'Access-Control-Request-Method': 'POST',
                     'Access-Control-Request-Headers': 'content-type'},
            method='OPTIONS',
        )
        with urllib.request.urlopen(preflight) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')
            self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), UI_ORIGIN)
        payload = {'username': 'fixtureadmin', 'display_name': 'Admin Fixture',
                   'password': 'synthetic testing passphrase with digits 2026'}
        status, _, _ = self.request_json('/api/auth/setup', payload, 'POST', origin='https://malicious.example')
        self.assertEqual(status, 403)

    def test_expired_session_is_rejected(self):
        _, cookie, _ = self.create_account()
        with api.transaction() as conn:
            conn.execute('UPDATE auth_sessions SET expires_at=0')
        status, _, _ = self.request_json('/api/participants', cookie=cookie)
        self.assertEqual(status, 401)
        status, state, _ = self.request_json('/api/auth/status', cookie=cookie)
        self.assertEqual(state, {'setup_required': False, 'authenticated': False})

    def test_login_rate_limit_returns_retry_after(self):
        password, _, _ = self.create_account()
        with api.LOGIN_LOCK:
            api.LOGIN_ATTEMPTS['127.0.0.1'] = [api.time.monotonic()] * api.LOGIN_MAX_FAILURES
        status, _, headers = self.request_json(
            '/api/auth/login', {'username': 'fixtureadmin', 'password': password}, 'POST',
        )
        self.assertEqual(status, 429)
        self.assertEqual(headers.get('Retry-After'), str(api.LOGIN_WINDOW_SECONDS))


if __name__ == '__main__':
    unittest.main()
