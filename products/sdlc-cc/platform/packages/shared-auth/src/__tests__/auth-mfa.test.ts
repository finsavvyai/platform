/**
 * MFA and token-expiration tests for auth.ts.
 * Extracted from auth.test.ts to keep each file under 200 lines.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockJwtSign = jest.fn<() => string>().mockReturnValue('signed-token');
const mockJwtVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  sign: (...args: any[]) => mockJwtSign(...args),
  verify: (...args: any[]) => mockJwtVerify(...args),
}));

const mockGenerateSecret = jest.fn();
const mockTotpVerify = jest.fn();
jest.mock('speakeasy', () => ({
  generateSecret: (...args: any[]) => mockGenerateSecret(...args),
  totp: { verify: (...args: any[]) => mockTotpVerify(...args) },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn<() => Promise<string>>().mockResolvedValue('data:image/png;base64,fake'),
}));

import {
  mockAuthSignInWithPassword,
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
// parseExpiration() – tested via login expiresIn
// ---------------------------------------------------------------------------
describe('parseExpiration (via login expiresIn)', () => {
  it.each([
    ['1d', 86400],
    ['24h', 86400],
    ['60m', 3600],
    ['3600s', 3600],
  ])('parses %s to %i seconds', async (exp, expected) => {
    const a = new SDLCAuth({ ...config, jwtExpiresIn: exp });
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const result = await a.login('alice@example.com', 'Str0ng!Pass');
    expect(result.expiresIn).toBe(expected);
  });

  it('throws for an invalid expiration format', () => {
    const a = new SDLCAuth({ ...config, jwtExpiresIn: 'invalid' });
    mockAuthSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    return expect(a.login('alice@example.com', 'Str0ng!Pass')).rejects.toThrow('Invalid expiration format');
  });
});

// ---------------------------------------------------------------------------
// setupMFA()
// ---------------------------------------------------------------------------
describe('SDLCAuth.setupMFA()', () => {
  beforeEach(() => {
    mockGenerateSecret.mockReturnValue({
      base32: 'BASE32SECRET',
      otpauth_url: 'otpauth://totp/SDLC.ai%20(user-1)?secret=BASE32SECRET',
    });
  });

  it('returns secret, qrCode, and 10 backup codes', async () => {
    const result = await auth.setupMFA('user-1');

    expect(result.secret).toBe('BASE32SECRET');
    expect(result.qrCode).toMatch(/^data:image/);
    expect(result.backupCodes).toHaveLength(10);
  });

  it('generates backup codes that are 8 uppercase alphanumeric characters', async () => {
    const result = await auth.setupMFA('user-1');
    for (const code of result.backupCodes) {
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('throws when speakeasy throws during secret generation', async () => {
    mockGenerateSecret.mockImplementation(() => { throw new Error('entropy error'); });
    await expect(auth.setupMFA('user-1')).rejects.toThrow('Failed to set up MFA');
  });
});

// ---------------------------------------------------------------------------
// verifyAndEnableMFA()
// ---------------------------------------------------------------------------
describe('SDLCAuth.verifyAndEnableMFA()', () => {
  it('resolves when the TOTP token is valid', async () => {
    mockTableResult('user_profiles', { data: { mfa_secret: 'BASE32SECRET' }, error: null });
    mockTotpVerify.mockReturnValue(true);

    await expect(auth.verifyAndEnableMFA('user-1', '123456')).resolves.toBeUndefined();
  });

  it('throws when TOTP token is invalid', async () => {
    mockTableResult('user_profiles', { data: { mfa_secret: 'BASE32SECRET' }, error: null });
    mockTotpVerify.mockReturnValue(false);

    await expect(auth.verifyAndEnableMFA('user-1', '000000')).rejects.toThrow('Failed to verify MFA');
  });

  it('throws when MFA has not been set up (no secret)', async () => {
    mockTableResult('user_profiles', { data: { mfa_secret: null }, error: null });

    await expect(auth.verifyAndEnableMFA('user-1', '123456')).rejects.toThrow('Failed to verify MFA');
  });
});
