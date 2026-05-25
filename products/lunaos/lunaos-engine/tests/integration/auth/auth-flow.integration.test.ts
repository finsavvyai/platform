/**
 * Auth Flow Integration Tests — signup, login, JWT, /auth/me
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../setup';

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx.dispose(); });

describe('POST /auth/signup', () => {
  it('creates a new user and returns JWT + user object', async () => {
    const res = await ctx.makeRequest('/auth/signup', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@lunaos.ai',
        password: 'SecurePass123!',
        name: 'New User',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('newuser@lunaos.ai');
    expect(body.user.name).toBe('New User');
    expect(body.user.tier).toBe('free');
    expect(body.user.id).toBeDefined();
  });

  it('rejects duplicate email with 409', async () => {
    const res = await ctx.makeRequest('/auth/signup', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@lunaos.ai',
        password: 'AnotherPass456!',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toMatch(/already registered/i);
  });

  it('rejects invalid email or short password', async () => {
    const badEmail = await ctx.makeRequest('/auth/signup', {
      auth: 'none', method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'SecurePass123!' }),
    });
    expect(badEmail.status).toBe(400);

    const shortPw = await ctx.makeRequest('/auth/signup', {
      auth: 'none', method: 'POST',
      body: JSON.stringify({ email: 'short@lunaos.ai', password: 'abc' }),
    });
    expect(shortPw.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns JWT for valid credentials', async () => {
    // First signup
    await ctx.makeRequest('/auth/signup', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'logintest@lunaos.ai',
        password: 'ValidPass123!',
      }),
    });

    // Then login
    const res = await ctx.makeRequest('/auth/login', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'logintest@lunaos.ai',
        password: 'ValidPass123!',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('logintest@lunaos.ai');
    expect(body.user.tier).toBe('free');
  });

  it('rejects wrong password with 401', async () => {
    const res = await ctx.makeRequest('/auth/login', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'logintest@lunaos.ai',
        password: 'WrongPassword!',
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error).toMatch(/invalid/i);
  });

  it('rejects non-existent email with 401', async () => {
    const res = await ctx.makeRequest('/auth/login', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'nobody@lunaos.ai',
        password: 'AnyPassword1!',
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns user info for authenticated request', async () => {
    // Sign up a fresh user, get token
    const signupRes = await ctx.makeRequest('/auth/signup', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'metest@lunaos.ai',
        password: 'SecurePass123!',
        name: 'Me Tester',
      }),
    });
    const { token } = await signupRes.json() as any;

    // Use that token to call /auth/me
    const res = await ctx.makeRequest('/auth/me', {
      auth: 'none',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.user.email).toBe('metest@lunaos.ai');
    expect(body.user.name).toBe('Me Tester');
  });

  it('rejects request without token', async () => {
    const res = await ctx.makeRequest('/auth/me', { auth: 'none' });
    expect(res.status).toBe(401);
  });

  it('rejects request with invalid token', async () => {
    const res = await ctx.makeRequest('/auth/me', {
      auth: 'none',
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(res.status).toBe(401);
  });
});

describe('Full signup -> login -> authenticated request cycle', () => {
  it('completes the full auth lifecycle', async () => {
    // 1. Signup
    const signupRes = await ctx.makeRequest('/auth/signup', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'lifecycle@lunaos.ai',
        password: 'Lifecycle123!',
        name: 'Lifecycle User',
      }),
    });
    expect(signupRes.status).toBe(201);

    // 2. Login with same creds
    const loginRes = await ctx.makeRequest('/auth/login', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({
        email: 'lifecycle@lunaos.ai',
        password: 'Lifecycle123!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json() as any;

    // 3. Use token to access protected route
    const meRes = await ctx.makeRequest('/auth/me', {
      auth: 'none',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status).toBe(200);
    const { user } = await meRes.json() as any;
    expect(user.email).toBe('lifecycle@lunaos.ai');
  });
});
