import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase browser client.
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build/runtime. When the
 * env vars are missing (typical for local dev or static previews) we fall back
 * to inert placeholder credentials so the module still loads and the UI can
 * render shells, empty states, and Apple-HIG-aligned error toasts instead of
 * crashing the whole SPA with a hard import error.
 *
 * Auth calls against the inert client will fail gracefully via Supabase's own
 * error path, which the AuthContext already surfaces.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'public-anon-placeholder-key';

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
