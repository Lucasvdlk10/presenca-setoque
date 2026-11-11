import { createClient } from '@supabase/supabase-js';
import { createSupabaseApi } from './supabaseApi.js';

const configuredMode = import.meta.env.VITE_BACKEND;
export const SUPABASE_MODE = configuredMode
  ? configuredMode === 'supabase'
  : Boolean(import.meta.env.PROD);

const localApiBase = (import.meta.env.VITE_LOCAL_API_URL || 'http://127.0.0.1:18766/api').replace(/\/$/, '');
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const apiBase = SUPABASE_MODE ? '' : localApiBase;

const supabaseClient = SUPABASE_MODE && supabaseUrl && publishableKey
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        flowType: 'pkce',
      },
    })
  : null;

const supabaseApi = supabaseClient
  ? createSupabaseApi(supabaseClient, { url: supabaseUrl, publishableKey })
  : null;

async function localApi(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body != null && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${localApiBase}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !['/auth/login', '/auth/password', '/auth/status'].includes(path)) {
    window.dispatchEvent(new Event('presence-auth-expired'));
  }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

export async function api(path, options = {}) {
  if (!SUPABASE_MODE) return localApi(path, options);
  if (!supabaseApi) throw new Error('Supabase não configurado para este ambiente.');
  try {
    return await supabaseApi(path, options);
  } catch (error) {
    if (error?.status === 401 && !['/auth/login', '/auth/password', '/auth/status'].includes(String(path).split('?')[0])) {
      window.dispatchEvent(new Event('presence-auth-expired'));
    }
    throw error;
  }
}
