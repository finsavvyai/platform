import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { vaultRoutes, gatewayVaultRoutes } from './vault.js';
import { vaultService } from '../services/vault.js';
import { Hono } from 'hono';

describe('Vault DELETE Routes & Gateway Vault Routes', () => {
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api', vaultRoutes);
    app.route('/agent', gatewayVaultRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── DELETE /instances/:id/secrets/:key ─────────────────────────────────

  describe('DELETE /instances/:id/secrets/:key', () => {
    it('returns 404 when instance does not belong to user', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_none/secrets/API_KEY',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns 404 when secret key does not exist', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.deleteSecret).mockResolvedValueOnce(false);

      const res = await app.request(
        '/api/instances/inst_1/secrets/MISSING_KEY',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Secret not found');
    });

    it('deletes secret and returns 200 with key confirmation', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.deleteSecret).mockResolvedValueOnce(true);

      const res = await app.request(
        '/api/instances/inst_1/secrets/DB_PASSWORD',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Secret deleted');
      expect(body.key).toBe('DB_PASSWORD');
    });

    it('calls vaultService.deleteSecret with correct arguments', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      vi.mocked(vaultService.deleteSecret).mockResolvedValueOnce(true);

      await app.request(
        '/api/instances/inst_1/secrets/MY_SECRET',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );

      expect(vaultService.deleteSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'inst_1',
          key: 'MY_SECRET',
        }),
      );
    });
  });

  // ─── Gateway vault route (agent-facing) ────────────────────────────────

  describe('GET /agent/instances/:id/secrets (gateway auth)', () => {
    const gatewayHeaders = {
      'X-Gateway-Token': 'valid-gateway-token',
      'X-Instance-Id': 'inst_gw',
    };

    beforeEach(async () => {
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_gw', 'valid-gateway-token');
    });

    it('returns 401 without gateway token headers', async () => {
      const res = await app.request('/agent/instances/inst_gw/secrets', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('returns 401 when gateway token does not match', async () => {
      const res = await app.request(
        '/agent/instances/inst_gw/secrets',
        {
          headers: {
            'X-Gateway-Token': 'wrong-token',
            'X-Instance-Id': 'inst_gw',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Invalid gateway token');
      expect(console.warn).toHaveBeenCalledWith('[GatewayAuth] Token mismatch for instance inst_gw');
    });

    it('returns decrypted secrets for authenticated agent', async () => {
      vi.mocked(vaultService.getDecryptedSecrets).mockResolvedValueOnce({
        API_KEY: 'plaintext-api-key',
        DB_PASS: 'plaintext-db-pass',
      });

      const res = await app.request(
        '/agent/instances/inst_gw/secrets',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.secrets).toEqual({
        API_KEY: 'plaintext-api-key',
        DB_PASS: 'plaintext-db-pass',
      });
    });

    it('returns empty object when instance has no secrets', async () => {
      vi.mocked(vaultService.getDecryptedSecrets).mockResolvedValueOnce({});

      const res = await app.request(
        '/agent/instances/inst_gw/secrets',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.secrets).toEqual({});
    });
  });
});
