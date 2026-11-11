import base64
import json
import sqlite3
import struct
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zlib
from pathlib import Path
from http.server import ThreadingHTTPServer
import api


def tiny_png():
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
    raw = b'\x00\xff\xff\xff\xff'
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>2I5B', 1, 1, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


class ParticipantPhotoApiTest(unittest.TestCase):
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
        payload = {'username': 'phototest', 'display_name': 'Test Admin',
                   'password': 'synthetic photo test passphrase 2026'}
        request = urllib.request.Request(
            cls.base + '/api/auth/setup', data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'Origin': api.AUTH_ORIGIN}, method='POST',
        )
        with urllib.request.urlopen(request) as response:
            cls.cookie = response.headers.get('Set-Cookie', '').split(';', 1)[0]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(timeout=2)
        api.DB = cls.original_db
        cls.temp.cleanup()

    def test_creating_person_persists_photo_and_returns_it_for_thumbnail(self):
        image = tiny_png()
        payload = {'name': 'Pessoa Foto Fixture', 'cpf': '987.654.321-00',
                   'photo_data': 'data:image/png;base64,' + base64.b64encode(image).decode()}
        req = urllib.request.Request(self.base + '/api/participants', data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json', 'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie}, method='POST')
        with urllib.request.urlopen(req) as response:
            self.assertEqual(response.status, 201)
        people_request = urllib.request.Request(
            self.base + '/api/participants',
            headers={'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie},
        )
        with urllib.request.urlopen(people_request) as response:
            people = json.load(response)
        person = next(p for p in people if p['cpf'] == payload['cpf'])
        self.assertTrue(person['has_photo'])
        photo_request = urllib.request.Request(
            self.base + '/api/participants/987.654.321-00/photo',
            headers={'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie},
        )
        with urllib.request.urlopen(photo_request) as response:
            self.assertEqual(response.headers.get_content_type(), 'image/png')
            self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), api.AUTH_ORIGIN)
            self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')
            self.assertEqual(response.headers.get('Cache-Control'), 'no-store')
            self.assertEqual(response.read(), image)

    def test_rejects_non_image_data(self):
        payload = {'name': 'Pessoa Foto Ruim', 'cpf': '987.654.321-01',
                   'photo_data': 'data:image/png;base64,' + base64.b64encode(b'not an image').decode()}
        req = urllib.request.Request(self.base + '/api/participants', data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json', 'Origin': api.AUTH_ORIGIN, 'Cookie': self.cookie}, method='POST')
        try:
            urllib.request.urlopen(req)
            self.fail('Expected invalid image response')
        except urllib.error.HTTPError as error:
            self.assertEqual(error.code, 400)
            error.close()
        db = sqlite3.connect(api.DB)
        try:
            self.assertEqual(db.execute('select count(*) from participants where cpf=?', (payload['cpf'],)).fetchone()[0], 0)
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
