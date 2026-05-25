/**
 * GitHub OAuth Integration Tests
 *
 * Tests the OAuth redirect -> callback -> status flow.
 * Since actual GitHub API calls are blocked by zero-trust,
 * we test the route logic and D1 state management.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
  TEST_USER,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('GET /github/auth — initiate OAuth', () => {
  it('returns GitHub OAuth URL with correct client_id and state', async () => {
    const res = await ctx.makeRequest('/github/auth', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url).toBeDefined();
    expect(body.url).toContain('github.com/login/oauth/authorize');
    expect(body.url).toContain('client_id=');
    expect(body.url).toContain('state=');
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/github/auth', { auth: 'none' });
    expect(res.status).toBe(401);
  });
});

describe('GET /github/callback — OAuth callback', () => {
  it('redirects with error when code or state is missing', async () => {
    const res = await ctx.makeRequest('/github/callback', {
      auth: 'none',
      redirect: 'manual',
    });

    // Should redirect to dashboard with error
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const location = res.headers.get('Location') || '';
    expect(location).toContain('error=missing_params');
  });

  it('redirects with error for invalid state', async () => {
    const res = await ctx.makeRequest(
      '/github/callback?code=test-code&state=invalid-state',
      { auth: 'none', redirect: 'manual' },
    );

    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const location = res.headers.get('Location') || '';
    expect(location).toContain('error=invalid_state');
  });
});

describe('GET /github/status — connection status', () => {
  it('returns connected: false when not connected', async () => {
    const res = await ctx.makeRequest('/github/status', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.connected).toBe(false);
  });

  it('returns connected: true after inserting connection', async () => {
    // Simulate a connection by inserting directly into D1
    await ctx.db
      .prepare(
        `INSERT INTO github_connections
         (id, user_id, github_username, github_id, access_token, scopes, connected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'gh-conn-test', TEST_USER.id, 'testuser',
        '12345', 'gho_test_token', 'read:user,repo',
        new Date().toISOString(),
      )
      .run();

    const res = await ctx.makeRequest('/github/status', { auth: 'user' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.connected).toBe(true);
    expect(body.username).toBe('testuser');
  });
});

describe('DELETE /github/disconnect', () => {
  it('removes GitHub connection', async () => {
    const res = await ctx.makeRequest('/github/disconnect', {
      auth: 'user',
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);

    // Verify disconnected
    const statusRes = await ctx.makeRequest('/github/status', {
      auth: 'user',
    });
    const statusBody = await statusRes.json() as any;
    expect(statusBody.connected).toBe(false);
  });
});
