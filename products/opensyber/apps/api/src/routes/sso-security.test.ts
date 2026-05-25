import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test'));

import worker from '../index.js';

async function request(path: string, init: RequestInit = {}, env: Env) {
  const req = new Request(`http://localhost${path}`, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('SSO Security Tests', () => {
  let env: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test'));
  });

  describe('SAML endpoints', () => {
    it('GET /api/sso/:slug/saml/login returns 404 for non-existent org', async () => {
      mockDb._setSelectResults([[]]);
      const res = await request('/api/sso/nonexistent/saml/login', {}, env);
      expect(res.status).toBe(404);
    });

    it('GET /api/sso/:slug/saml/login returns 404 when SSO not configured', async () => {
      mockDb._setSelectResults([
        [{ id: 'org_1', slug: 'test-org' }],
        [], // no SSO config
      ]);
      const res = await request('/api/sso/test-org/saml/login', {}, env);
      expect(res.status).toBe(404);
    });

    it('GET /api/sso/:slug/saml/metadata returns 404 for non-existent org', async () => {
      mockDb._setSelectResults([[]]);
      const res = await request('/api/sso/nonexistent/saml/metadata', {}, env);
      expect(res.status).toBe(404);
    });

    it('POST /api/sso/:slug/saml/acs returns 404 when org not found', async () => {
      mockDb._setSelectResults([[]]);
      const res = await request('/api/sso/nonexistent/saml/acs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'SAMLResponse=abc',
      }, env);
      expect(res.status).toBe(404);
    });

    it('POST /api/sso/:slug/saml/acs returns 404 when SSO config inactive', async () => {
      mockDb._setSelectResults([
        [{ id: 'org_1', slug: 'test-org', ownerId: 'user_1' }],
        [], // no active SSO config
      ]);
      const res = await request('/api/sso/test-org/saml/acs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'SAMLResponse=abc',
      }, env);
      expect(res.status).toBe(404);
    });
  });

  describe('OIDC endpoints', () => {
    it('GET /api/sso/:slug/oidc/login returns 404 for non-existent org', async () => {
      mockDb._setSelectResults([[]]);
      const res = await request('/api/sso/nonexistent/oidc/login', {}, env);
      expect(res.status).toBe(404);
    });

    it('GET /api/sso/:slug/oidc/callback returns 400 without code', async () => {
      const res = await request('/api/sso/test-org/oidc/callback', {}, env);
      expect(res.status).toBe(400);
    });

    it('GET /api/sso/:slug/oidc/callback returns 400 with invalid state', async () => {
      // KV returns null for unknown state
      const res = await request('/api/sso/test-org/oidc/callback?code=abc&state=invalid', {}, env);
      expect(res.status).toBe(400);
    });

    it('GET /api/sso/:slug/oidc/login returns 404 when SSO not configured', async () => {
      mockDb._setSelectResults([
        [{ id: 'org_1', slug: 'test-org' }],
        [], // no SSO config
      ]);
      const res = await request('/api/sso/test-org/oidc/login', {}, env);
      expect(res.status).toBe(404);
    });
  });
});
