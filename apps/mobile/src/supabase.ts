import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_KEY = 'nomad.supabase.session';

export type CloudUser = {
  id: string;
  email?: string;
};

export type CloudSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: CloudUser;
};

export function supabaseConfigured(): boolean {
  return url.startsWith('http') && anonKey.length > 20;
}

const memory = {
  getItem: async (key: string) => {
    if (Platform.OS !== 'web') {
      const secure = await SecureStore.getItemAsync(key);
      if (secure != null) return secure;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch {
        // Session JSON can exceed SecureStore size on some devices.
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(key);
    }
    await AsyncStorage.removeItem(key);
  },
};

let cachedSession: CloudSession | null | undefined;

export async function readSession(): Promise<CloudSession | null> {
  if (!supabaseConfigured()) return null;
  if (cachedSession !== undefined) return cachedSession;
  const raw = await memory.getItem(SESSION_KEY);
  if (!raw) {
    cachedSession = null;
    return null;
  }
  try {
    cachedSession = JSON.parse(raw) as CloudSession;
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

async function writeSession(session: CloudSession | null): Promise<void> {
  cachedSession = session;
  if (session) {
    await memory.setItem(SESSION_KEY, JSON.stringify(session));
    return;
  }
  await memory.removeItem(SESSION_KEY);
}

function headers(token?: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token ?? anonKey}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error_description?: string; message?: string; error?: string };
    return body.error_description ?? body.message ?? body.error ?? `${response.status}`;
  } catch {
    return `${response.status}`;
  }
}

async function authRequest(path: string, body: Record<string, string>): Promise<CloudSession> {
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Could not reach Nomad cloud sign-in. Check your connection, or ask for a build with the current Supabase project URL.',
    );
  }
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CloudSession;
  if (!payload.access_token || !payload.user?.id) {
    throw new Error('Sign-in did not return a session.');
  }
  await writeSession(payload);
  return payload;
}

export async function signInWithPassword(email: string, password: string): Promise<CloudSession> {
  if (!supabaseConfigured()) throw new Error('Cloud save is not configured.');
  return authRequest('token?grant_type=password', { email: email.trim(), password });
}

export async function signUpWithPassword(email: string, password: string): Promise<CloudSession | null> {
  if (!supabaseConfigured()) throw new Error('Cloud save is not configured.');
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    throw new Error(
      'Could not reach Nomad cloud sign-up. Check your connection, or ask for a build with the current Supabase project URL.',
    );
  }
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CloudSession;
  if (payload.access_token && payload.user?.id) {
    await writeSession(payload);
    return payload;
  }
  return null;
}

export async function signOutSession(): Promise<void> {
  const session = await readSession();
  if (session && supabaseConfigured()) {
    await fetch(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: headers(session.access_token),
    });
  }
  await writeSession(null);
}

export async function restSelect<T>(table: string, userId: string): Promise<T[]> {
  const session = await requireSession();
  const response = await fetch(
    `${url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    { headers: headers(session.access_token) },
  );
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T[];
}

export async function restDelete(table: string, id: string): Promise<void> {
  const session = await readSession();
  if (!session) return;
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(session.access_token),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function restDeleteOwned(table: string, userId: string, id: string): Promise<void> {
  const session = await readSession();
  if (!session) return;
  const response = await fetch(
    `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: headers(session.access_token),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
}

export async function restDeleteMissing(
  table: string,
  userId: string,
  keepIds: string[],
): Promise<void> {
  const remote = await restSelect<{ id: string }>(table, userId);
  const keep = new Set(keepIds);
  await Promise.all(
    remote.filter((row) => !keep.has(row.id)).map((row) => restDeleteOwned(table, userId, row.id)),
  );
}

export async function restSelectOptional<T>(table: string, userId: string): Promise<T[] | undefined> {
  try {
    return await restSelect<T>(table, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('404') ||
      message.includes('PGRST') ||
      message.includes('does not exist') ||
      message.includes('schema cache')
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function restUpsert(table: string, rows: object[], onConflict?: string): Promise<void> {
  if (rows.length === 0) return;
  const session = await requireSession();
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: {
      ...headers(session.access_token),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function uploadSketch(path: string, blob: Blob): Promise<void> {
  const session = await requireSession();
  const response = await fetch(`${url}/storage/v1/object/memoir-sketches/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: blob,
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function signedSketchUrl(path: string): Promise<string | null> {
  const session = await requireSession();
  const response = await fetch(`${url}/storage/v1/object/sign/memoir-sketches/${path}`, {
    method: 'POST',
    headers: headers(session.access_token),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signed = payload.signedURL ?? payload.signedUrl;
  if (!signed) return null;
  return signed.startsWith('http') ? signed : `${url}/storage/v1${signed}`;
}

async function requireSession(): Promise<CloudSession> {
  const session = await readSession();
  if (!session) throw new Error('Not signed in.');
  return session;
}
