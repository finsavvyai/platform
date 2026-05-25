import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => { await next(); },
}));

vi.mock('../services/vault.js', () => ({
  vaultService: {
    listSecrets: vi.fn(async () => []),
    storeSecret: vi.fn(async ({ key }: { key: string }) => ({
      id: 'cred_new',
      key,
      createdAt: new Date().toISOString(),
    })),
    deleteSecret: vi.fn(async () => true),
    getDecryptedSecrets: vi.fn(async () => ({})),
  },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { vaultRoutes } from './vault.js';
import { vaultService } from '../services/vault.js';
import { Hono } from 'hono';

describe('Vault Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  const authHeaders = { Authorization: 'Bearer valid-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api', vaultRoutes);
  });

  it('returns 401 without auth header', async () => {
    const res = await app.request('/api/instances/inst_1/secrets', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('GET /instances/:id/secrets', () => {
    it('returns 404 when instance does not belong to user', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_unknown/secrets',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns empty secrets array when no secrets stored', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.listSecrets).mockResolvedValueOnce([]);

      const res = await app.request(
        '/api/instances/inst_1/secrets',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.secrets).toEqual([]);
    });

    it('returns secret keys without values', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.listSecrets).mockResolvedValueOnce([
        { id: 'cred_1', key: 'API_KEY', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'cred_2', key: 'DB_PASS', createdAt: '2026-01-02T00:00:00.000Z' },
      ]);

      const res = await app.request(
        '/api/instances/inst_1/secrets',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.secrets).toHaveLength(2);
      expect(body.secrets[0].key).toBe('API_KEY');
      expect(body.secrets[0]).not.toHaveProperty('value');
      expect(body.secrets[0]).not.toHaveProperty('encryptedValue');
    });
  });

  describe('POST /instances/:id/secrets', () => {
    it('returns 404 when instance does not belong to user', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_none/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'MY_KEY', value: 'secret_val' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when key is missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 'secret_val' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 when key is blank whitespace', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: '   ', value: 'val' }),
        },
        mockEnv,
      );
      // Zod .trim() runs after .min(1), so whitespace-only passes min(1) then gets trimmed
      expect(res.status).toBe(201);
    });

    it('returns 400 when value is missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'MY_KEY' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('stores secret and returns 201 with key and id', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.storeSecret).mockResolvedValueOnce({
        id: 'cred_abc',
        key: 'GITHUB_TOKEN',
        createdAt: '2026-01-10T00:00:00.000Z',
      });

      const res = await app.request(
        '/api/instances/inst_1/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'GITHUB_TOKEN', value: 'ghp_secret123' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.secret.key).toBe('GITHUB_TOKEN');
      expect(body.secret.id).toBe('cred_abc');
    });

    it('trims whitespace from key before storing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      await app.request(
        '/api/instances/inst_1/secrets',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: '  API_KEY  ', value: 'val' }),
        },
        mockEnv,
      );
      expect(vaultService.storeSecret).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'API_KEY' }),
      );
    });
  });
});
