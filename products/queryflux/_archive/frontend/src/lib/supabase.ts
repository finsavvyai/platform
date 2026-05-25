import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a mock client for development/demo when env vars are missing
const mockSupabase = {
  from: () => ({
    select: () => ({
      order: () => ({
        data: [],
        error: null
      })
    }),
    insert: () => ({
      select: () => ({
        data: null,
        error: { message: 'Demo mode - database not configured' }
      })
    }),
    update: () => ({
      eq: () => ({
        data: null,
        error: { message: 'Demo mode - database not configured' }
      })
    }),
    delete: () => ({
      eq: () => ({
        data: null,
        error: { message: 'Demo mode - database not configured' }
      })
    }),
    eq: () => ({
      data: null,
      error: { message: 'Demo mode - database not configured' }
    })
  }),
  auth: {
    getUser: () => ({ data: { user: null }, error: null }),
    signInWithOAuth: () => ({ data: null, error: { message: 'Demo mode' } }),
    signOut: () => ({ error: null })
  }
};

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockSupabase as any;

export interface Connection {
  id: string;
  user_id: string;
  name: string;
  database_type: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_enabled?: boolean;
  connection_url?: string;
  project?: string;
  environment?: string;
  color?: string;
  icon?: string;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface ConnectionHistory {
  id: string;
  connection_id: string;
  user_id: string;
  connected_at: string;
  duration_seconds?: number;
  queries_executed: number;
  status: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface SavedQuery {
  id: string;
  user_id: string;
  connection_id?: string;
  name: string;
  description?: string;
  query_text: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: string;
  audio_enabled: boolean;
  default_query_limit: number;
  auto_save_enabled: boolean;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}
