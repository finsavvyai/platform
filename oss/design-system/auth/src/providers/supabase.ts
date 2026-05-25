import { AuthUser } from '../types';

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export class SupabaseAuthProvider {
  private url: string;
  private anonKey: string;
  private serviceRoleKey?: string;

  constructor(config: SupabaseConfig) {
    if (!config.url || !config.anonKey) {
      throw new Error('Supabase url and anonKey are required');
    }
    this.url = config.url;
    this.anonKey = config.anonKey;
    this.serviceRoleKey = config.serviceRoleKey;
  }

  async verifySupabaseToken(token: string): Promise<SupabaseUser> {
    if (!token) {
      throw new Error('Token is required');
    }

    try {
      const response = await fetch(`${this.url}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: this.anonKey,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Supabase verification failed: ${response.statusText}`
        );
      }

      const user = await response.json();
      return user;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Supabase token verification failed: ${message}`);
    }
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const supabaseUser = await this.verifySupabaseToken(token);

      if (!supabaseUser.id) {
        throw new Error('No user ID in token');
      }

      const email = supabaseUser.email || 'unknown@example.com';
      const role =
        (supabaseUser.user_metadata?.role as string) || 'user';

      return {
        id: supabaseUser.id,
        email,
        role: role as 'admin' | 'user' | 'guest',
        permissions: [],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Supabase auth failed: ${message}`);
    }
  }

  async getUser(token: string): Promise<SupabaseUser> {
    return this.verifySupabaseToken(token);
  }
}

export function createSupabaseAuth(config: SupabaseConfig): SupabaseAuthProvider {
  return new SupabaseAuthProvider(config);
}
