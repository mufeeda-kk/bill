// Supabase Client and Connection State Management
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://lmhtttbkuhzvetptqaid.supabase.co';

const STORAGE_URL_KEY = 'vcs_supabase_url';
const STORAGE_KEY_KEY = 'vcs_supabase_anon_key';

// Read from build environment variables first, then fallback to local runtime storage or default store URL
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  let storageUrl = '';
  let storageKey = '';
  try {
    storageUrl = (localStorage.getItem(STORAGE_URL_KEY) || '').trim();
    storageKey = (localStorage.getItem(STORAGE_KEY_KEY) || '').trim();
  } catch {
    // Ignore storage access errors
  }

  const finalUrl = (envUrl && !envUrl.includes('your-project-id')) 
    ? envUrl 
    : (storageUrl || DEFAULT_SUPABASE_URL);

  const finalKey = (envKey && !envKey.includes('your-anon-public-key')) ? envKey : storageKey;

  return { url: finalUrl, anonKey: finalKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  try {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  } catch (e) {
    console.error('Failed to save Supabase credentials', e);
  }
}

export function clearSupabaseCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
  } catch (e) {
    console.error('Failed to clear Supabase credentials', e);
  }
}

export function checkIsSupabaseConfigured(url: string, key: string): boolean {
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    !url.includes('your-project-id') &&
    url.includes('.supabase.co') &&
    (key.startsWith('eyJ') || key.startsWith('sb_publishable_') || key.length > 20)
  );
}

const creds = getSupabaseCredentials();
export const isSupabaseConfigured = checkIsSupabaseConfigured(creds.url, creds.anonKey);

// Create Supabase client singleton
function instantiateClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!checkIsSupabaseConfigured(url, anonKey)) {
    return null;
  }

  try {
    return createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: false, // We use device token auth, not user sessions
      },
    });
  } catch (err) {
    console.error('Failed to instantiate Supabase client:', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = instantiateClient();

// Multi-tab broadcast channel for local testing across browser tabs
export const localBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('vcs_realtime_sync')
  : null;
