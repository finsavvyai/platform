import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv } from '../test/helpers.js';

// Unmock the auth middleware globally to test the real implementation
vi.unmock('../middleware/auth.js');

import { authMiddleware } from './auth.js';

const TEST_SECRET = 'test-auth-secret-for-hmac-verification';

/** Create a valid HMAC-SHA256 signed JWT for testing */
async function createTestJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  );
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

describe('authMiddleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv({ AUTH_SECRET: TEST_SECRET });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ userId: c.get('userId') }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/test', {}, mockEnv);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('Missing or invalid authorization header');
  });

  it('rejects requests with non-Bearer Authorization header', async () => {
    const res = await app.request(
      '/test',
      { headers: { Authorization: 'Basic abc123' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects requests with malformed token', async () => {
    const res = await app.request(
      '/test',
      { headers: { Authorization: 'Bearer malformed-token' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_expired', iat: now - 7200, exp: now - 3600 },
      TEST_SECRET,
    );

    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Token expired');
  });

  it('rejects tokens with tampered payload', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_original', iat: now, exp: now + 3600 },
      TEST_SECRET,
    );

    // Tamper with the payload by replacing it
    const parts = token.split('.');
    const tamperedPayload = btoa(JSON.stringify({ sub: 'user_hacker', iat: now, exp: now + 3600 }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${tamperedToken}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Invalid token signature');
  });

  it('rejects tokens signed with wrong secret', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_wrong', iat: now, exp: now + 3600 },
      'wrong-secret',
    );

    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Invalid token signature');
  });

  it('passes with valid HMAC token and sets userId', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_test123', iat: now, exp: now + 3600 },
      TEST_SECRET,
    );

    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user_test123');
  });

  it('rejects tokens missing the exp claim', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_noexp', iat: now },
      TEST_SECRET,
    );
    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Token missing exp claim');
  });

  it('rejects tokens with alg other than HS256', async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = btoa(JSON.stringify({ sub: 'attacker', iat: now, exp: now + 3600 }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${header}.${payload}.`;
    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Unsupported token algorithm');
  });

  it('rejects tokens with future nbf claim', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createTestJwt(
      { sub: 'user_future', iat: now, nbf: now + 600, exp: now + 3600 },
      TEST_SECRET,
    );
    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${token}` } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Token not yet valid');
  });
});
