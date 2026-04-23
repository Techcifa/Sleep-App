import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Check your .env file.');
}

/**
 * On Android (Capacitor), localStorage is stored in the WebView cache and can
 * be wiped by the OS under memory pressure, killing the user's session.
 *
 * We replace it with a custom storage adapter backed by @capacitor/preferences,
 * which writes to Android's native SharedPreferences — a file that persists
 * permanently across app restarts and memory events.
 *
 * Supabase's storage interface supports both sync (localStorage-style) and
 * async (Promise-returning) adapters. Capacitor Preferences is async-only,
 * so this adapter returns Promises, which Supabase handles correctly.
 *
 * On web, we pass undefined and Supabase falls back to the built-in localStorage.
 */

function buildCapacitorStorageAdapter() {
  return {
    getItem: (key: string): Promise<string | null> =>
      Preferences.get({ key }).then(({ value }) => value),

    setItem: (key: string, value: string): Promise<void> =>
      Preferences.set({ key, value }),

    removeItem: (key: string): Promise<void> =>
      Preferences.remove({ key }),
  };
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use native persistent SharedPreferences on Android, localStorage on web
    storage: Capacitor.isNativePlatform()
      ? buildCapacitorStorageAdapter()
      : undefined,
    // Always persist sessions across restarts
    persistSession: true,
    // Silently refresh tokens in the background
    autoRefreshToken: true,
    // Detect session from URL hash (needed for email confirmation deep links)
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
});
