const PHOTO_BUCKET = 'participant-photos';
const PHOTO_URL_TTL_SECONDS = 3600;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const VALID_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_COLUMNS = 'user_id,display_name';

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); }
    catch { throw new Error('Dados enviados inválidos.'); }
  }
  return body;
}

function appError(error, fallback = 'Não foi possível concluir a operação.') {
  if (!error) return new Error(fallback);
  let message = fallback;
  if (error.code === '23505') message = 'Já existe um participante com esse CPF.';
  else if (error.code === '23503') message = 'O participante ou encontro informado não existe.';
  else if (error.code === '23514' || error.code === '22023') message = 'Confira os dados e tente novamente.';
  else if (error.code === '42501' || error.status === 401 || error.status === 403) message = 'Sessão inválida ou conta sem permissão.';
  else if (error.status === 429) message = 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  const wrapped = new Error(message);
  if (error.status) wrapped.status = error.status;
  if (error.code) wrapped.code = error.code;
  return wrapped;
}

function throwIfError(error, fallback) {
  if (error) throw appError(error, fallback);
}

function signedInProfile(user, profile) {
  return {
    username: user.email || '',
    email: user.email || '',
    display_name: profile.display_name,
  };
}

function validateCpf(value) {
  const cpf = String(value || '').trim();
  const digits = cpf.replace(/\D/g, '');
  if (!/^[0-9.-]+$/.test(cpf) || digits.length !== 11) {
    throw new Error('Informe um CPF com 11 dígitos.');
  }
  return cpf;
}

function imageFromDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!match || !VALID_PHOTO_TYPES.has(match[1].toLowerCase())) {
    throw new Error('A foto precisa ser JPG, PNG ou WebP.');
  }
  const mimeType = match[1].toLowerCase();
  let binary;
  try { binary = atob(match[2]); }
  catch { throw new Error('Os dados da foto são inválidos.'); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('A foto excede o limite permitido.');
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
  return { blob: new Blob([bytes], { type: mimeType }), mimeType, extension };
}

function createUuid(uuidFactory) {
  const value = uuidFactory();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Não foi possível gerar um identificador seguro.');
  }
  return value;
}

export function createSupabaseApi(client, {
  url = '',
  publishableKey = '',
  fetchImpl = globalThis.fetch?.bind(globalThis),
  uuidFactory = () => globalThis.crypto?.randomUUID?.(),
} = {}) {
  const storage = client?.storage?.from(PHOTO_BUCKET);

  async function getAuthState() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    throwIfError(sessionError, 'Não foi possível verificar a sessão.');
    if (!sessionData?.session) return { setup_required: false, authenticated: false };

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* sessão inválida */ }
      return { setup_required: false, authenticated: false };
    }

    const user = userData.user;
    const { data: profile, error: profileError } = await client
      .from('app_profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throwIfError(profileError, 'Não foi possível verificar a permissão da conta.');
    if (!profile) {
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* acesso não autorizado */ }
      return { setup_required: false, authenticated: false, access_denied: true };
    }

    return { setup_required: false, authenticated: true, profile: signedInProfile(user, profile) };
  }

  async function getCurrentUser() {
    const { data, error } = await client.auth.getUser();
    throwIfError(error, 'Sessão inválida. Entre novamente.');
    if (!data?.user) throw new Error('Sessão inválida. Entre novamente.');
    return data.user;
  }

  async function uploadPhoto(participantId, dataUrl) {
    const { blob, mimeType, extension } = imageFromDataUrl(dataUrl);
    const path = `${participantId}/${createUuid(uuidFactory)}.${extension}`;
    const { error } = await storage.upload(path, blob, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: false,
    });
    throwIfError(error, 'Não foi possível salvar a foto.');
    return { path, mimeType };
  }

  async function removePhotoQuietly(path) {
    if (!path) return;
    try { await storage.remove([path]); }
    catch { /* arquivo órfão privado; não expõe dados e pode ser limpo depois */ }
  }

  async function listParticipants() {
    const { data, error } = await client
      .from('participants')
      .select('id,cpf,name,active,phone,email,birth_date,notes,photo_path,photo_mime_type,created_at')
      .order('active', { ascending: false })
      .order('name', { ascending: true });
    throwIfError(error, 'Não foi possível carregar os participantes.');
    const rows = data || [];
    const paths = rows.map(row => row.photo_path).filter(Boolean);
    const urlsByPath = new Map();
    if (paths.length) {
      const { data: signedUrls, error: signedError } = await storage.createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
      if (!signedError && signedUrls) {
        for (const item of signedUrls) {
          if (item.path && item.signedUrl) urlsByPath.set(item.path, item.signedUrl);
        }
      }
    }
    return rows.map(row => {
      const photoUrl = row.photo_path ? urlsByPath.get(row.photo_path) || null : null;
      return {
        id: row.id,
        cpf: row.cpf,
        name: row.name,
        active: Boolean(row.active),
        phone: row.phone || '',
        email: row.email || '',
        birth_date: row.birth_date || '',
        notes: row.notes || '',
        created_at: row.created_at,
        has_photo: Boolean(photoUrl),
        photo_url: photoUrl,
      };
    });
  }

  async function createParticipant(body) {
    const id = createUuid(uuidFactory);
    const cpf = validateCpf(body.cpf);
    const name = String(body.name || '').trim();
    if (name.length < 2) throw new Error('O nome precisa ter pelo menos 2 caracteres.');

    let uploaded = null;
    try {
      if (body.photo_data) uploaded = await uploadPhoto(id, body.photo_data);
      const row = {
        id,
        cpf,
        name,
        active: true,
        phone: String(body.phone || '').trim(),
        email: String(body.email || '').trim(),
        birth_date: body.birth_date || null,
        notes: String(body.notes || '').trim(),
        photo_path: uploaded?.path || null,
        photo_mime_type: uploaded?.mimeType || null,
      };
      const { data, error } = await client
        .from('participants')
        .insert(row)
        .select('cpf,photo_path')
        .single();
      if (error) throw appError(error, 'Não foi possível cadastrar o participante.');
      return { ok: true, cpf: data.cpf, has_photo: Boolean(data.photo_path) };
    } catch (error) {
      if (uploaded?.path) await removePhotoQuietly(uploaded.path);
      throw error;
    }
  }

  async function updateParticipant(path, body) {
    const match = /^\/participants\/([^/]+)$/.exec(path);
    if (!match) throw new Error('Rota não encontrada.');
    const oldCpf = decodeURIComponent(match[1]);
    const { data: current, error: lookupError } = await client
      .from('participants')
      .select('id,cpf,photo_path,photo_mime_type')
      .eq('cpf', oldCpf)
      .maybeSingle();
    throwIfError(lookupError, 'Não foi possível localizar o participante.');
    if (!current) throw new Error('Participante não encontrado.');

    const removePhoto = body.remove_photo === true;
    const hasNewPhoto = Boolean(body.photo_data);
    if (body.remove_photo !== undefined && typeof body.remove_photo !== 'boolean') {
      throw new Error('Ação de foto inválida.');
    }
    if (removePhoto && hasNewPhoto) throw new Error('Escolha substituir ou remover a foto, não ambos.');

    const changes = {};
    if ('name' in body) {
      changes.name = String(body.name || '').trim();
      if (changes.name.length < 2) throw new Error('O nome precisa ter pelo menos 2 caracteres.');
    }
    if ('cpf' in body) changes.cpf = validateCpf(body.cpf);
    for (const field of ['phone', 'email', 'notes']) {
      if (field in body) changes[field] = String(body[field] || '').trim();
    }
    if ('birth_date' in body) changes.birth_date = body.birth_date || null;
    if ('active' in body) {
      if (typeof body.active !== 'boolean') throw new Error('Estado ativo inválido.');
      changes.active = body.active;
    }
    if (!Object.keys(changes).length && !removePhoto && !hasNewPhoto) {
      throw new Error('Sem campos para atualizar.');
    }

    let uploaded = null;
    if (hasNewPhoto) {
      uploaded = await uploadPhoto(current.id, body.photo_data);
      changes.photo_path = uploaded.path;
      changes.photo_mime_type = uploaded.mimeType;
    } else if (removePhoto) {
      changes.photo_path = null;
      changes.photo_mime_type = null;
    }

    let updated;
    try {
      const { data, error } = await client
        .from('participants')
        .update(changes)
        .eq('id', current.id)
        .select('cpf,photo_path')
        .single();
      if (error) throw appError(error, 'Não foi possível atualizar o participante.');
      updated = data;
    } catch (error) {
      if (uploaded?.path) await removePhotoQuietly(uploaded.path);
      throw error;
    }

    if ((uploaded || removePhoto) && current.photo_path && current.photo_path !== updated.photo_path) {
      await removePhotoQuietly(current.photo_path);
    }
    return { ok: true, cpf: updated.cpf, has_photo: Boolean(updated.photo_path) };
  }

  return async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const body = parseBody(options.body);
    const [pathname, queryString = ''] = String(path).split('?', 2);

    if (pathname === '/health' && method === 'GET') {
      if (!url || !publishableKey || typeof fetchImpl !== 'function') {
        throw new Error('Supabase não configurado para este ambiente.');
      }
      try {
        const response = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
          headers: { apikey: publishableKey },
        });
        if (!response.ok) throw new Error();
        return { ok: true, storage: 'Supabase' };
      } catch {
        throw new Error('Supabase indisponível. Confira a conexão e a configuração pública.');
      }
    }

    if (pathname === '/auth/status' && method === 'GET') return getAuthState();

    if (pathname === '/auth/setup' && method === 'POST') {
      throw new Error('A primeira conta deve ser criada no Supabase Auth pelo administrador.');
    }

    if (pathname === '/auth/login' && method === 'POST') {
      const email = String(body.username || body.email || '').trim();
      if (!email || !body.password) throw new Error('Informe e-mail e senha.');
      const { error } = await client.auth.signInWithPassword({ email, password: body.password });
      if (error) throw new Error('E-mail ou senha inválidos.');
      const state = await getAuthState();
      if (!state.authenticated) {
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* conta sem acesso */ }
        throw new Error('Esta conta ainda não recebeu acesso ao sistema.');
      }
      return { ok: true, profile: state.profile };
    }

    if (pathname === '/auth/profile' && method === 'GET') {
      const state = await getAuthState();
      if (!state.authenticated) throw new Error('Sessão inválida. Entre novamente.');
      return { profile: state.profile };
    }

    if (pathname === '/auth/profile' && method === 'POST') {
      const state = await getAuthState();
      if (!state.authenticated) throw new Error('Sessão inválida. Entre novamente.');
      const displayName = String(body.display_name || '').trim();
      if (displayName.length < 2 || displayName.length > 80) throw new Error('O nome do perfil deve ter de 2 a 80 caracteres.');
      const user = await getCurrentUser();
      const { data, error } = await client
        .from('app_profiles')
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select(PROFILE_COLUMNS)
        .single();
      throwIfError(error, 'Não foi possível salvar o perfil.');
      return { ok: true, profile: signedInProfile(user, data) };
    }

    if (pathname === '/auth/password' && method === 'POST') {
      const user = await getCurrentUser();
      const newPassword = String(body.new_password || '');
      if (newPassword.length < 15) throw new Error('A nova senha precisa ter pelo menos 15 caracteres.');
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: user.email,
        password: String(body.current_password || ''),
      });
      if (reauthError) throw new Error('A senha atual está incorreta.');
      const { error } = await client.auth.updateUser({ password: newPassword });
      throwIfError(error, 'Não foi possível alterar a senha.');
      const state = await getAuthState();
      return { ok: true, profile: state.profile };
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      const { error } = await client.auth.signOut({ scope: 'local' });
      throwIfError(error, 'Não foi possível encerrar a sessão.');
      return { ok: true };
    }

    if (pathname === '/participants' && method === 'GET') return listParticipants();
    if (pathname === '/participants' && method === 'POST') return createParticipant(body);
    if (pathname.startsWith('/participants/') && method === 'PATCH') return updateParticipant(pathname, body);

    if (pathname === '/attendance' && method === 'GET') {
      const params = new URLSearchParams(queryString);
      const start = params.get('start');
      const end = params.get('end');
      if (!start || !end || start > end) throw new Error('Confira as datas do período.');
      const { data: meetings, error: meetingError } = await client
        .from('meetings')
        .select('id')
        .gte('meeting_date', start)
        .lte('meeting_date', end);
      throwIfError(meetingError, 'Não foi possível carregar os encontros.');
      const meetingIds = (meetings || []).map(meeting => meeting.id);
      if (!meetingIds.length) return [];
      const { data, error } = await client
        .from('attendance')
        .select('id,status,notes,participants!inner(cpf,name),meetings!inner(meeting_date)')
        .in('meeting_id', meetingIds)
        .order('meeting_id', { ascending: true });
      throwIfError(error, 'Não foi possível carregar as presenças.');
      return (data || []).map(row => ({
        id: row.id,
        data: row.meetings?.meeting_date || '',
        cpf: row.participants?.cpf || '',
        nome: row.participants?.name || '',
        status: row.status,
        observacao: row.notes || '',
      }));
    }

    if (pathname === '/attendance/batch' && method === 'POST') {
      if (!body.date || !Array.isArray(body.records)) throw new Error('Lançamento de presença inválido.');
      const { data, error } = await client.rpc('save_attendance_batch', {
        p_meeting_date: body.date,
        p_records: body.records.map(row => ({
          cpf: String(row.cpf || '').trim(),
          status: String(row.status || ''),
          observacao: String(row.observacao || ''),
        })),
      });
      throwIfError(error, 'Não foi possível salvar as presenças.');
      return { ok: true, saved: Number(data) || 0 };
    }

    if (pathname === '/summary' && method === 'GET') {
      const [participants, records] = await Promise.all([
        client.from('participants').select('id', { count: 'exact', head: true }).eq('active', true),
        client.from('attendance').select('id', { count: 'exact', head: true }),
      ]);
      throwIfError(participants.error || records.error, 'Não foi possível carregar o resumo.');
      return { participants: participants.count || 0, records: records.count || 0 };
    }

    throw new Error('Rota não encontrada.');
  };
}
