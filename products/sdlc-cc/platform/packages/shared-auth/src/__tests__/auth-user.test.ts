/**
 * User-session and feature-access tests for SDLCAuth.
 * Covers: getCurrentUser, hasFeatureAccess, updateUserTier.
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
// getCurrentUser()
// ---------------------------------------------------------------------------
describe('SDLCAuth.getCurrentUser()', () => {
  it('returns the user when a session exists', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const user = await auth.getCurrentUser();
    expect(user?.id).toBe('user-1');
  });

  it('returns null when no session exists', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it('returns null when getUser throws', async () => {
    mockAuthGetUser.mockRejectedValue(new Error('session error'));
    expect(await auth.getCurrentUser()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasFeatureAccess()
// ---------------------------------------------------------------------------
describe('SDLCAuth.hasFeatureAccess()', () => {
  it('returns true for rag (enabled for all tiers)', async () => {
    expect(await auth.hasFeatureAccess('user-1', 'rag')).toBe(true);
  });

  it('returns false for compliance on starter tier', async () => {
    expect(await auth.hasFeatureAccess('user-1', 'compliance')).toBe(false);
  });

  it('returns true for compliance on professional tier', async () => {
    mockTableResult('user_profiles', { data: { ...baseProfile, tier: 'professional' }, error: null });
    expect(await auth.hasFeatureAccess('user-1', 'compliance')).toBe(true);
  });

  it('returns true for realtimeStreaming on enterprise tier', async () => {
    mockTableResult('user_profiles', { data: { ...baseProfile, tier: 'enterprise' }, error: null });
    expect(await auth.hasFeatureAccess('user-1', 'realtimeStreaming')).toBe(true);
  });

  it('returns false when getUserData throws', async () => {
    mockTableResult('user_profiles', { data: null, error: { message: 'not found' } });
    expect(await auth.hasFeatureAccess('missing', 'rag')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateUserTier()
// ---------------------------------------------------------------------------
describe('SDLCAuth.updateUserTier()', () => {
  it('resolves for professional tier upgrade', async () => {
    await expect(auth.updateUserTier('user-1', 'professional')).resolves.toBeUndefined();
  });

  it('resolves for enterprise tier upgrade', async () => {
    await expect(auth.updateUserTier('user-1', 'enterprise')).resolves.toBeUndefined();
  });

  it('resolves for downgrade back to starter', async () => {
    await expect(auth.updateUserTier('user-1', 'starter')).resolves.toBeUndefined();
  });

  it('triggers logAudit with update_tier action', async () => {
    const spy = jest.spyOn(auth as any, 'logAudit').mockResolvedValue(undefined);
    await auth.updateUserTier('user-1', 'enterprise');
    const tierCall = spy.mock.calls.find((c) => c[1] === 'update_tier');
    expect(tierCall).toBeDefined();
  });
});
