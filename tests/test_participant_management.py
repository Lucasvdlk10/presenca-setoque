import base64
import datetime
import json
import sqlite3
import struct
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zlib
from http.server import ThreadingHTTPServer
from pathlib import Path
import api


def tiny_png(rgb=(20, 100, 200)):
    def chunk(kind, data):
        payload = kind + data
        return struct.pack('>I', len(data)) + payload + struct.pack('>I', zlib.crc32(payload) & 0xffffffff)
    raw = b'\x00' + bytes(rgb) + b'\xff'
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>2I5B', 1, 1, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))


class ParticipantManagementApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.original_db = api.DB
        api.DB = Path(cls.temp.name) / 'test.sqlite3'
        api.init_db()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'
        payload = {'username': 'participanttest', 'display_name': 'Test Admin',
                   'password': 'synthetic participant test passphrase 2026'}
        request = urllib.request.Request(
            cls.base + '/api/auth/setup', data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'Origin': api.AUTH_ORIGIN}, method='POST',
        )
        with urllib.request.urlopen(request) as response:
            cls.cookie = response.headers.get('Set-Cookie', '').split(';', 1)[0]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        api.DB = cls.original_db
        cls.temp.cleanup()

    def setUp(self):
        with api.transaction() as conn:
            conn.execute('DELETE FROM attendance')
            conn.execute('DELETE FROM participant_photos')
            conn.execute('DELETE FROM participants')

    def request_json(self, path, payload=None, method='GET'):
        data = None if payload is None else json.dumps(payload).encode()
        headers = {'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(
            self.base + path, data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            status = error.code
            body = json.load(error)
            error.close()
            return status, body

    def create_person(self, cpf, image=None):
        payload = {'name': 'Participante de teste', 'cpf': cpf, 'phone': '0000'}
        if image:
            payload['photo_data'] = 'data:image/png;base64,' + base64.b64encode(image).decode()
        status, body = self.request_json('/api/participants', payload, 'POST')
        self.assertEqual(status, 201, body)
        return body

    def get_people(self):
        status, people = self.request_json('/api/participants')
        self.assertEqual(status, 200)
        return people

    def photo(self, cpf):
        request = urllib.request.Request(
            self.base + '/api/participants/' + urllib.parse.quote(cpf, safe='') + '/photo',
            headers={'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie},
        )
        with urllib.request.urlopen(request) as response:
            return response.headers.get_content_type(), response.read()

    def test_patch_updates_profile_and_replaces_photo(self):
        original = tiny_png((20, 100, 200))
        replacement = tiny_png((220, 40, 80))
        cpf = '111.111.111-11'
        self.create_person(cpf, original)
        status, result = self.request_json(
            '/api/participants/' + urllib.parse.quote(cpf, safe=''),
            {'name': 'Nome corrigido', 'phone': '11999990000', 'email': 'teste@example.com',
             'birth_date': '1990-01-02', 'notes': 'Observação atualizada',
             'photo_data': 'data:image/png;base64,' + base64.b64encode(replacement).decode()},
            'PATCH',
        )
        self.assertEqual(status, 200, result)
        person = next(p for p in self.get_people() if p['cpf'] == cpf)
        self.assertEqual(person['name'], 'Nome corrigido')
        self.assertEqual(person['phone'], '11999990000')
        self.assertEqual(person['email'], 'teste@example.com')
        self.assertEqual(person['birth_date'], '1990-01-02')
        self.assertEqual(person['notes'], 'Observação atualizada')
        self.assertTrue(person['has_photo'])
        self.assertEqual(self.photo(cpf), ('image/png', replacement))

    def test_patch_can_change_cpf_without_losing_attendance_or_photo(self):
        old_cpf = '111.111.111-11'
        new_cpf = '222.222.222-22'
        image = tiny_png()
        self.create_person(old_cpf, image)
        monday = datetime.date.today() + datetime.timedelta(days=(-datetime.date.today().weekday()) % 7)
        day = monday.isoformat()
        status, result = self.request_json(
            '/api/attendance/batch',
            {'date': day, 'records': [{'cpf': old_cpf, 'status': 'Presente', 'observacao': 'fixture'}]},
            'POST',
        )
        self.assertEqual(status, 200, result)
        status, result = self.request_json(
            '/api/participants/' + urllib.parse.quote(old_cpf, safe=''),
            {'cpf': new_cpf, 'name': 'CPF atualizado'}, 'PATCH',
        )
        self.assertEqual(status, 200, result)
        people = self.get_people()
        self.assertFalse(any(p['cpf'] == old_cpf for p in people))
        updated = next(p for p in people if p['cpf'] == new_cpf)
        self.assertEqual(updated['name'], 'CPF atualizado')
        self.assertTrue(updated['has_photo'])
        status, rows = self.request_json(f'/api/attendance?start={day}&end={day}')
        self.assertEqual(status, 200)
        self.assertEqual([(row['cpf'], row['status']) for row in rows], [(new_cpf, 'Presente')])
        self.assertEqual(self.photo(new_cpf), ('image/png', image))
        old_photo = urllib.request.Request(
            self.base + '/api/participants/' + urllib.parse.quote(old_cpf, safe='') + '/photo',
            headers={'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie},
        )
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(old_photo)
        self.assertEqual(caught.exception.code, 404)
        caught.exception.close()

    def test_patch_can_remove_photo(self):
        cpf = '333.333.333-33'
        self.create_person(cpf, tiny_png())
        status, result = self.request_json(
            '/api/participants/' + urllib.parse.quote(cpf, safe=''),
            {'remove_photo': True}, 'PATCH',
        )
        self.assertEqual(status, 200, result)
        person = next(p for p in self.get_people() if p['cpf'] == cpf)
        self.assertFalse(person['has_photo'])

    def test_invalid_cpf_does_not_partially_update_profile(self):
        cpf = '444.444.444-44'
        self.create_person(cpf)
        status, _ = self.request_json(
            '/api/participants/' + urllib.parse.quote(cpf, safe=''),
            {'cpf': 'bad', 'name': 'Não deve salvar'}, 'PATCH',
        )
        self.assertEqual(status, 400)
        person = next(p for p in self.get_people() if p['cpf'] == cpf)
        self.assertEqual(person['name'], 'Participante de teste')

    def test_duplicate_cpf_is_rejected_without_changing_either_person(self):
        first = '555.555.555-55'
        second = '666.666.666-66'
        self.create_person(first)
        self.create_person(second)
        status, _ = self.request_json(
            '/api/participants/' + urllib.parse.quote(first, safe=''),
            {'cpf': second}, 'PATCH',
        )
        self.assertEqual(status, 409)
        names = {p['cpf']: p['name'] for p in self.get_people()}
        self.assertEqual(names[first], 'Participante de teste')
        self.assertEqual(names[second], 'Participante de teste')


if __name__ == '__main__':
    unittest.main()
