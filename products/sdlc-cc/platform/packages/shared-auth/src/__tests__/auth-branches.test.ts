/**
 * Supplemental branch-coverage tests for auth.ts.
 * Covers: stored feature overrides, profileError throws, non-Error catch branches.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockJwtSign = jest.fn<() => string>().mockReturnValue('signed-token');
const mockJwtVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  sign: (...args: any[]) => mockJwtSign(...args),
  verify: (...args: any[]) => mockJwtVerify(...args),
}));

jest.mock('speakeasy', () => ({ generateSecret: jest.fn(), totp: { verify: jest.fn() } }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

import {
  mockAuthGetUser,
  mockAuthSignUp,
  mockTableResult,
  clearTableResults,
} from './__mocks__/supabase';

import { SDLCAuth } from '../auth';
import type { AuthConfig } from '../types';

const config: AuthConfig = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'anon-key',
  supabaseServiceRoleKey: 'service-role-key',
  jwtSecret: 'test-jwt-secret',
  jwtExpiresIn: '7d',
  refreshTokenExpiresIn: '30d',
  frontendUrl: 'http://localhost:3000',
};

const baseProfile = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  tier: 'starter',
  features: null,
  organization_id: null,
  tenant_id: null,
  preferences: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let auth: SDLCAuth;

beforeEach(() => {
  jest.clearAllMocks();
  clearTableResults();
  auth = new SDLCAuth(config);
  mockTableResult('user_profiles', { data: baseProfile, error: null });
  mockTableResult('audit_logs', { data: {}, error: null });
  mockTableResult('subscriptions', { data: {}, error: null });
});

// ---------------------------------------------------------------------------
// getUserData – stored features override branch (profile.features is truthy)
// ---------------------------------------------------------------------------
describe('getUserData stored features override', () => {
  it('merges stored features over tier-derived defaults', async () => {
    mockTableResult('user_profiles', {
      data: { ...baseProfile, features: { rag: false, compliance: true } },
      error: null,
    });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const user = await auth.getCurrentUser();
    expect(user?.features.rag).toBe(false);
    expect(user?.features.compliance).toBe(true);
  });

  it('derives compliance=true for professional tier when no stored override', async () => {
    mockTableResult('user_profiles', { data: { ...baseProfile, tier: 'professional' }, error: null });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const user = await auth.getCurrentUser();
    expect(user?.features.compliance).toBe(true);
    expect(user?.features.realtimeStreaming).toBe(false);
  });

  it('derives realtimeStreaming=true for enterprise tier', async () => {
    mockTableResult('user_profiles', { data: { ...baseProfile, tier: 'enterprise' }, error: null });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const user = await auth.getCurrentUser();
    expect(user?.features.realtimeStreaming).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getUserData – profileError throw path
// ---------------------------------------------------------------------------
describe('getUserData profileError path', () => {
  it('returns null via getCurrentUser when profile query has error', async () => {
    mockTableResult('user_profiles', { data: null, error: { message: 'row not found' } });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    // getCurrentUser swallows the error and returns null
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it('verifyToken throws "Invalid or expired" when getUserData fails', async () => {
    mockTableResult('user_profiles', { data: null, error: { message: 'DB error' } });
    mockJwtVerify.mockReturnValue({ userId: 'user-1', type: 'access' });

    await expect(auth.verifyToken('tok')).rejects.toThrow('Invalid or expired access token');
  });
});

// ---------------------------------------------------------------------------
// updateFeatureAccess – error branch
// ---------------------------------------------------------------------------
describe('updateFeatureAccess error branch', () => {
  it('throws with "Failed to update feature access" text', async () => {
    jest.spyOn(auth as any, 'logAudit').mockRejectedValue(new Error('audit down'));
    await expect(auth.updateFeatureAccess('user-1', { rag: false })).rejects.toThrow(
      'Failed to update feature access'
    );
  });

  it('includes "Unknown error" when thrown value is not an Error instance', async () => {
    jest.spyOn(auth as any, 'logAudit').mockRejectedValue('plain string');
    await expect(auth.updateFeatureAccess('user-1', { rag: false })).rejects.toThrow(
      'Unknown error'
    );
  });
});

// ---------------------------------------------------------------------------
// updateUserTier – error branch
// ---------------------------------------------------------------------------
describe('updateUserTier error branch', () => {
  it('throws with "Failed to update user tier" when an error occurs', async () => {
    jest.spyOn(auth as any, 'logAudit').mockRejectedValue(new Error('audit failure'));
    await expect(auth.updateUserTier('user-1', 'professional')).rejects.toThrow(
      'Failed to update user tier'
    );
  });
});

// ---------------------------------------------------------------------------
// login – rememberMe flag
// ---------------------------------------------------------------------------
describe('login rememberMe flag', () => {
  it('passes without error with rememberMe=true', async () => {
    const { mockAuthSignInWithPassword } = await import('./__mocks__/supabase');
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const result = await auth.login('alice@example.com', 'Str0ng!Pass', true);
    expect(result.user).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// adminClient getter
// ---------------------------------------------------------------------------
describe('adminClient getter', () => {
  it('returns an object with a from() method', () => {
    const client = auth.adminClient;
    expect(typeof client.from).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// validatePassword – remaining branches (via register)
// ---------------------------------------------------------------------------
describe('validatePassword remaining branches (via register)', () => {
  beforeEach(() => {
    mockAuthSignUp.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null });
    mockTableResult('user_profiles', { data: { ...baseProfile, id: 'user-2' }, error: null });
  });

  it('rejects a password with no digit', async () => {
    await expect(auth.register({ email: 'a@b.com', password: 'Str!ongPass', name: 'A' }))
      .rejects.toThrow('number');
  });

  it('rejects a password with no lowercase letter', async () => {
    await expect(auth.register({ email: 'a@b.com', password: 'STR0NG!PASS', name: 'A' }))
      .rejects.toThrow('lowercase');
  });
});
