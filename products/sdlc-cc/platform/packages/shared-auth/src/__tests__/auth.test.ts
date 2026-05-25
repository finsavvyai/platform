/**
 * Core authentication tests for SDLCAuth.
 * MFA tests live in auth-mfa.test.ts.
 * Additional branch coverage lives in auth-branches.test.ts.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockJwtSign = jest.fn<() => string>().mockReturnValue('signed-token');
const mockJwtVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  sign: (...args: any[]) => mockJwtSign(...args),
  verify: (...args: any[]) => mockJwtVerify(...args),
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn() },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn<() => Promise<string>>().mockResolvedValue('data:image/png;base64,fake'),
}));

import {
  mockAuthSignInWithPassword,
  mockAuthSignUp,
  mockAuthSignOut,
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
// login()
// ---------------------------------------------------------------------------
describe('SDLCAuth.login()', () => {
  it('returns user, accessToken, refreshToken, expiresIn on success', async () => {
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const result = await auth.login('alice@example.com', 'Str0ng!Pass');
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('throws when Supabase returns an auth error', async () => {
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid credentials' } });
    await expect(auth.login('alice@example.com', 'bad')).rejects.toThrow('Authentication failed');
  });

  it('throws when Supabase returns no user', async () => {
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
    await expect(auth.login('alice@example.com', 'Str0ng!Pass')).rejects.toThrow('No user returned from login');
  });

  it('uses default 7-day expiration when jwtExpiresIn is not set', async () => {
    const a = new SDLCAuth({ ...config, jwtExpiresIn: undefined });
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const result = await a.login('alice@example.com', 'Str0ng!Pass');
    expect(result.expiresIn).toBe(7 * 24 * 60 * 60);
  });
});

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------
describe('SDLCAuth.register()', () => {
  const req = { email: 'bob@example.com', password: 'Str0ng!Pass', name: 'Bob', tier: 'starter' as const };

  beforeEach(() => {
    mockAuthSignUp.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null });
    mockTableResult('user_profiles', { data: { ...baseProfile, id: 'user-2', email: 'bob@example.com', name: 'Bob' }, error: null });
  });

  it('returns LoginResponse on success', async () => {
    const result = await auth.register(req);
    expect(result.user.email).toBe('bob@example.com');
    expect(result.accessToken).toBeTruthy();
  });

  it('throws for a short password', async () => {
    await expect(auth.register({ ...req, password: 'weak' })).rejects.toThrow('at least 8 characters');
  });

  it('throws for missing uppercase', async () => {
    await expect(auth.register({ ...req, password: 'str0ng!pass' })).rejects.toThrow('uppercase');
  });

  it('throws for missing special character', async () => {
    await expect(auth.register({ ...req, password: 'Str0ngPass' })).rejects.toThrow('special character');
  });

  it('throws when Supabase signUp returns an error', async () => {
    mockAuthSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email taken' } });
    await expect(auth.register(req)).rejects.toThrow('Registration failed');
  });

  it('throws when Supabase returns no user after signUp', async () => {
    mockAuthSignUp.mockResolvedValue({ data: { user: null }, error: null });
    await expect(auth.register(req)).rejects.toThrow('No user returned from registration');
  });

  it('defaults tier to starter when omitted', async () => {
    const { tier: _omit, ...noTier } = req;
    await auth.register(noTier);
    expect(mockAuthSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ data: expect.objectContaining({ tier: 'starter' }) }) })
    );
  });
});

// ---------------------------------------------------------------------------
// refreshToken()
// ---------------------------------------------------------------------------
describe('SDLCAuth.refreshToken()', () => {
  it('returns new tokens for a valid refresh token', async () => {
    mockJwtVerify.mockReturnValue({ userId: 'user-1', type: 'refresh' });
    const result = await auth.refreshToken('valid-refresh-token');
    expect(result.accessToken).toBeTruthy();
    expect(result.user.id).toBe('user-1');
  });

  it('throws when token type is not "refresh"', async () => {
    mockJwtVerify.mockReturnValue({ userId: 'user-1', type: 'access' });
    await expect(auth.refreshToken('access-token')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('throws when jwt.verify throws', async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error('jwt expired'); });
    await expect(auth.refreshToken('bad-token')).rejects.toThrow('Invalid or expired refresh token');
  });
});

// ---------------------------------------------------------------------------
// verifyToken()
// ---------------------------------------------------------------------------
describe('SDLCAuth.verifyToken()', () => {
  it('returns the user when token is valid', async () => {
    mockJwtVerify.mockReturnValue({ userId: 'user-1', type: 'access' });
    const user = await auth.verifyToken('valid-token');
    expect(user.id).toBe('user-1');
  });

  it('throws when jwt.verify throws', async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error('invalid signature'); });
    await expect(auth.verifyToken('bad-token')).rejects.toThrow('Invalid or expired access token');
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------
describe('SDLCAuth.logout()', () => {
  it('calls signOut without throwing', async () => {
    mockAuthSignOut.mockResolvedValue({ error: null });
    await expect(auth.logout('user-1')).resolves.toBeUndefined();
    expect(mockAuthSignOut).toHaveBeenCalled();
  });

  it('does not throw when signOut fails', async () => {
    mockAuthSignOut.mockRejectedValue(new Error('network error'));
    await expect(auth.logout('user-1')).resolves.toBeUndefined();
  });
});

