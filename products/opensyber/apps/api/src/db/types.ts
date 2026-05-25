/**
 * Database row types inferred from Drizzle schemas.
 * Defines TypeScript interfaces for all database tables.
 */

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
};

export type TokenRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled';
  started_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

export type SessionRow = {
  id: string;
  user_id: string;
  ip: string;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
};

export type CreateUserInput = {
  id?: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
};

export type CreateSubscriptionInput = {
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  expires_at: Date;
};

export type UpdateSubscriptionInput = {
  status?: 'active' | 'expired' | 'cancelled';
  expires_at?: Date;
};
