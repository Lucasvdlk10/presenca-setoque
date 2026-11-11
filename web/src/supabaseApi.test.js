import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseApi } from './supabaseApi.js';

function createMockClient(overrides = {}) {
  const calls = [];
  const user = overrides.user ?? { id: 'user-test-uuid', email: 'lucas@example.invalid', user_metadata: {} };
  const session = overrides.session ?? { user, access_token: 'synthetic-session-token' };
  const profile = overrides.profile ?? { user_id: user.id, display_name: 'Lucas' };
  const participants = overrides.participants ?? [];

  const client = {
    calls,
    auth: {
      getSession: async () => ({ data: { session: Object.hasOwn(overrides, 'currentSession') ? overrides.currentSession : session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      signInWithPassword: async credentials => {
        calls.push({ method: 'signInWithPassword', credentials });
        return overrides.signInResult ?? { data: { user, session }, error: null };
      },
      signOut: async options => {
        calls.push({ method: 'signOut', options });
        return { error: null };
      },
      updateUser: async attributes => {
        calls.push({ method: 'updateUser', attributes });
        return { data: { user }, error: null };
      },
    },
    from(table) {
      let operation = 'select';
      const query = { table, filters: {}, columns: '*' };
      const builder = {
        select(columns = '*') { query.columns = columns; return builder; },
        eq(column, value) { query.filters[column] = value; return builder; },
        gte(column, value) { query.filters[`gte:${column}`] = value; return builder; },
        lte(column, value) { query.filters[`lte:${column}`] = value; return builder; },
        in(column, values) { query.filters[`in:${column}`] = values; return builder; },
        order(column, options) { query.order = { column, options }; return builder; },
        insert(values) { operation = 'insert'; query.values = values; calls.push({ method: 'insert', table, values }); return builder; },
        update(values) { operation = 'update'; query.values = values; calls.push({ method: 'update', table, values }); return builder; },
        maybeSingle() { return Promise.resolve(resolve(table, operation, query)); },
        single() { return Promise.resolve(resolve(table, operation, query)); },
        then(resolvePromise, rejectPromise) {
          return Promise.resolve(resolve(table, operation, query)).then(resolvePromise, rejectPromise);
        },
      };
      return builder;
    },
    rpc(name, args) {
      calls.push({ method: 'rpc', name, args });
      return Promise.resolve({ data: overrides.rpcResult ?? 1, error: null });
    },
    storage: {
      from(bucket) {
        return {
          createSignedUrls: async (paths, expiresIn) => {
            calls.push({ method: 'createSignedUrls', bucket, paths, expiresIn });
            return { data: paths.map(path => ({ path, signedUrl: `https://signed.invalid/${path}` })), error: null };
          },
          upload: async (path, blob, options) => {
            calls.push({ method: 'upload', bucket, path, bytes: blob.size, contentType: options.contentType });
            return { data: { path }, error: null };
          },
          remove: async paths => {
            calls.push({ method: 'remove', bucket, paths });
            return { data: paths, error: null };
          },
        };
      },
    },
  };

  function resolve(table, operation, query) {
    calls.push({ method: 'query', table, operation, query: structuredClone(query) });
    if (table === 'app_profiles' && operation === 'select') {
      return { data: overrides.profileResult === undefined ? profile : overrides.profileResult, error: null };
    }
    if (table === 'participants' && operation === 'select') {
      return { data: participants, error: null };
    }
    if (table === 'meetings' && operation === 'select') {
      return { data: overrides.meetings ?? [], error: null };
    }
    if (table === 'attendance' && operation === 'select') {
      return { data: overrides.attendance ?? [], error: null };
    }
    if (table === 'participants' && operation === 'insert') {
      const values = Array.isArray(query.values) ? query.values[0] : query.values;
      if (overrides.participantInsertError) return { data: null, error: overrides.participantInsertError };
      return { data: { id: values.id ?? 'participant-test-uuid', ...values }, error: null };
    }
    if (table === 'participants' && operation === 'update') {
      return { data: { id: 'participant-test-uuid', ...query.values }, error: null };
    }
    return { data: null, error: null };
  }

  return client;
}

test('Supabase auth login uses email and returns the active admin profile', async () => {
  const client = createMockClient();
  const api = createSupabaseApi(client, { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  const result = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'lucas@example.invalid', password: 'synthetic-test-password' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.profile.display_name, 'Lucas');
  assert.equal(result.profile.email, 'lucas@example.invalid');
  assert.deepEqual(client.calls.find(call => call.method === 'signInWithPassword').credentials, {
    email: 'lucas@example.invalid',
    password: 'synthetic-test-password',
  });
});

test('Supabase auth status does not expose an unauthenticated profile', async () => {
  const client = createMockClient({ currentSession: null });
  const api = createSupabaseApi(client, { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  const result = await api('/auth/status');
  assert.deepEqual(result, { setup_required: false, authenticated: false });
  assert.equal(client.calls.some(call => call.table === 'app_profiles'), false);
});

test('attendance save uses one transactional RPC with the existing UI payload', async () => {
  const client = createMockClient({ rpcResult: 1 });
  const api = createSupabaseApi(client, { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  const records = [{ cpf: '000.000.000-00', status: 'Presente', observacao: 'synthetic note' }];
  const result = await api('/attendance/batch', {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-09', records }),
  });
  assert.deepEqual(result, { ok: true, saved: 1 });
  assert.deepEqual(client.calls.find(call => call.method === 'rpc'), {
    method: 'rpc',
    name: 'save_attendance_batch',
    args: { p_meeting_date: '2026-11-09', p_records: records },
  });
});

test('attendance read filters by meeting ids and maps joined records to the UI shape', async () => {
  const client = createMockClient({
    meetings: [{ id: 'meeting-test-uuid' }],
    attendance: [{
      id: 'attendance-test-uuid', status: 'Presente', notes: 'synthetic note',
      participants: { cpf: '000.000.000-00', name: 'Synthetic Person' },
      meetings: { meeting_date: '2026-11-09' },
    }],
  });
  const api = createSupabaseApi(client, { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  const rows = await api('/attendance?start=2026-11-01&end=2026-11-30');
  assert.deepEqual(rows, [{
    id: 'attendance-test-uuid', data: '2026-11-09', cpf: '000.000.000-00',
    nome: 'Synthetic Person', status: 'Presente', observacao: 'synthetic note',
  }]);
  const meetingQuery = client.calls.find(call => call.method === 'query' && call.table === 'meetings');
  assert.equal(meetingQuery.query.filters['gte:meeting_date'], '2026-11-01');
  assert.equal(meetingQuery.query.filters['lte:meeting_date'], '2026-11-30');
  const attendanceQuery = client.calls.find(call => call.method === 'query' && call.table === 'attendance');
  assert.deepEqual(attendanceQuery.query.filters['in:meeting_id'], ['meeting-test-uuid']);
});

test('participant listing maps Supabase fields and signs private photo URLs', async () => {
  const client = createMockClient({ participants: [{
    id: 'participant-test-uuid', cpf: '000.000.000-00', name: 'Synthetic Person', active: true,
    phone: '', email: '', birth_date: null, notes: '', photo_path: 'participant-test-uuid/photo.jpg',
    photo_mime_type: 'image/jpeg', created_at: '2026-11-10T12:00:00Z',
  }] });
  const api = createSupabaseApi(client, { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  const people = await api('/participants');
  assert.equal(people[0].has_photo, true);
  assert.equal(people[0].photo_url, 'https://signed.invalid/participant-test-uuid/photo.jpg');
  assert.equal(Object.hasOwn(people[0], 'photo_path'), false);
  assert.equal(people[0].birth_date, '');
  assert.equal(client.calls.some(call => call.method === 'createSignedUrls' && call.bucket === 'participant-photos'), true);
});

test('Supabase mode refuses local first-run account setup', async () => {
  const api = createSupabaseApi(createMockClient(), { url: 'https://project.invalid', publishableKey: 'public-test-key' });
  await assert.rejects(
    api('/auth/setup', { method: 'POST', body: JSON.stringify({ username: 'test', password: 'synthetic-test-password' }) }),
    /Supabase Auth/i,
  );
});

test('participant photo is uploaded privately before the database row is inserted', async () => {
  const ids = [
    '123e4567-e89b-42d3-a456-426614174000',
    '123e4567-e89b-42d3-b456-426614174001',
  ];
  const client = createMockClient();
  const api = createSupabaseApi(client, {
    url: 'https://project.invalid', publishableKey: 'public-test-key', uuidFactory: () => ids.shift(),
  });
  const result = await api('/participants', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Synthetic Person', cpf: '000.000.000-00', phone: '', email: '', birth_date: '', notes: '',
      photo_data: 'data:image/jpeg;base64,aGVsbG8=',
    }),
  });
  assert.deepEqual(result, { ok: true, cpf: '000.000.000-00', has_photo: true });
  const upload = client.calls.find(call => call.method === 'upload');
  assert.equal(upload.bucket, 'participant-photos');
  assert.equal(upload.path, '123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-b456-426614174001.jpg');
  assert.equal(upload.contentType, 'image/jpeg');
  const insertIndex = client.calls.findIndex(call => call.method === 'insert');
  const uploadIndex = client.calls.findIndex(call => call.method === 'upload');
  assert.ok(uploadIndex < insertIndex);
});

test('failed participant insert cleans up the uploaded private photo', async () => {
  const ids = [
    '123e4567-e89b-42d3-a456-426614174000',
    '123e4567-e89b-42d3-b456-426614174001',
  ];
  const client = createMockClient({ participantInsertError: { code: '23505' } });
  const api = createSupabaseApi(client, {
    url: 'https://project.invalid', publishableKey: 'public-test-key', uuidFactory: () => ids.shift(),
  });
  await assert.rejects(api('/participants', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Synthetic Person', cpf: '000.000.000-00', photo_data: 'data:image/jpeg;base64,aGVsbG8=',
    }),
  }), /Já existe um participante/);
  assert.equal(client.calls.some(call => call.method === 'remove' && call.bucket === 'participant-photos'), true);
});
