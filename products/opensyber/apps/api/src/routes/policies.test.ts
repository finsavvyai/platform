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

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { policyRoutes, gatewayPolicyRoutes } from './policies.js';
import { Hono } from 'hono';

describe('Policy Routes', () => {
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
    app.route('/api/security', policyRoutes);
    app.route('/api/agent/security', gatewayPolicyRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Auth guard ──────────────────────────────────────────────────────

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/security/instances/inst_1/policies', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── GET /instances/:instanceId/policies (Clerk auth) ────────────────

  describe('GET /api/security/instances/:instanceId/policies', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
      expect(body.message).toBe('Instance not found');
    });

    it('returns empty policy list when instance has no policies', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [],
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policies).toEqual([]);
    });

    it('returns policy list for the instance', async () => {
      const policies = [
        { id: 'pol_1', instanceId: 'inst_1', policyType: 'network_allowlist', name: 'Allow internal', rules: '["10.0.0.0/8"]', isActive: true },
        { id: 'pol_2', instanceId: 'inst_1', policyType: 'rate_limit', name: 'API rate limit', rules: '{"max":100}', isActive: true },
      ];
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        policies,
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policies).toHaveLength(2);
      expect(body.policies[0].id).toBe('pol_1');
      expect(body.policies[1].id).toBe('pol_2');
    });

    it('does not return policies for another user\'s instance', async () => {
      mockDb._setSelectResult([]); // instance query returns nothing for wrong user
      const res = await app.request(
        '/api/security/instances/inst_other/policies',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/agent/security/instances/:instanceId/policies (gateway auth)', () => {
    it('returns 401 with invalid gateway token', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_1/policies',
        {
          headers: {
            'X-Gateway-Token': 'wrong-token',
            'X-Instance-Id': 'inst_1',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      expect(console.warn).toHaveBeenCalledWith('[GatewayAuth] Token mismatch for instance inst_1');
    });
  });

  // ─── POST /instances/:instanceId/policies (Clerk auth) ───────────────

  describe('POST /api/security/instances/:instanceId/policies', () => {
    const validBody = {
      policyType: 'network_allowlist',
      name: 'Allow internal traffic',
      rules: '["10.0.0.0/8"]',
    };

    it('creates a policy and returns 201', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(validBody),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.policy).toBeDefined();
      expect(body.policy.policyType).toBe('network_allowlist');
      expect(body.policy.name).toBe('Allow internal traffic');
      expect(body.policy.rules).toBe('["10.0.0.0/8"]');
      expect(body.policy.isActive).toBe(true);
      expect(body.policy.id).toBeDefined();
      expect(body.policy.instanceId).toBe('inst_1');
      expect(body.policy.createdAt).toBeDefined();
      expect(body.policy.updatedAt).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(validBody),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when policyType is missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'test', rules: '{}' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 when name is missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyType: 'rate_limit', rules: '{}' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 when rules is missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyType: 'rate_limit', name: 'test' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 for invalid policyType enum', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyType: 'invalid_type', name: 'test', rules: '{}' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Invalid enum value');
    });

    it('validates all accepted policyType values', async () => {
      const validTypes = [
        'network_allowlist', 'network_blocklist', 'file_path_rules',
        'shell_command_rules', 'ip_allowlist', 'rate_limit',
      ];
      for (const policyType of validTypes) {
        vi.clearAllMocks();
        mockDb = createMockDb();
        (globalThis as any).__mockDb = mockDb;
        mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);

        const res = await app.request(
          '/api/security/instances/inst_1/policies',
          {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ policyType, name: `${policyType} policy`, rules: '{}' }),
          },
          mockEnv,
        );
        expect(res.status).toBe(201);
      }
    });

    it('returns 400 when rules is not valid JSON', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyType: 'rate_limit', name: 'test', rules: 'not-json{' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('rules must be valid JSON');
    });

    it('accepts complex JSON rules', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const complexRules = JSON.stringify({ max: 100, window: '1m', paths: ['/api/*'] });
      const res = await app.request(
        '/api/security/instances/inst_1/policies',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyType: 'rate_limit', name: 'Complex', rules: complexRules }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.policy.rules).toBe(complexRules);
    });
  });

  // ─── PATCH /instances/:instanceId/policies/:id (Clerk auth) ──────────

  describe('PATCH /api/security/instances/:instanceId/policies/:id', () => {
    it('updates a policy name', async () => {
      const existingPolicy = {
        id: 'pol_1', instanceId: 'inst_1', policyType: 'rate_limit',
        name: 'Old Name', rules: '{"max":50}', isActive: true,
        createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
      };
      const updatedPolicy = { ...existingPolicy, name: 'New Name', updatedAt: '2026-02-24T00:00:00Z' };
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [existingPolicy],
        [updatedPolicy],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policy.name).toBe('New Name');
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('updates policy rules with valid JSON', async () => {
      const existingPolicy = {
        id: 'pol_1', instanceId: 'inst_1', policyType: 'rate_limit',
        name: 'Rate Limit', rules: '{"max":50}', isActive: true,
      };
      const updatedPolicy = { ...existingPolicy, rules: '{"max":200}' };
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [existingPolicy],
        [updatedPolicy],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: '{"max":200}' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policy.rules).toBe('{"max":200}');
    });

    it('returns 400 when updated rules is not valid JSON', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'pol_1', instanceId: 'inst_1' }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: 'bad-json{' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('rules must be valid JSON');
    });

    it('updates isActive field', async () => {
      const existingPolicy = {
        id: 'pol_1', instanceId: 'inst_1', policyType: 'rate_limit',
        name: 'Rate Limit', rules: '{}', isActive: true,
      };
      const updatedPolicy = { ...existingPolicy, isActive: false };
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [existingPolicy],
        [updatedPolicy],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policy.isActive).toBe(false);
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns 404 when policy not found', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [],
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_nonexistent',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Policy not found');
    });
  });

  // ─── DELETE /instances/:instanceId/policies/:id (Clerk auth) ─────────

  describe('DELETE /api/security/instances/:instanceId/policies/:id', () => {
    it('deletes a policy and returns confirmation', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'pol_1', instanceId: 'inst_1', policyType: 'rate_limit', name: 'Rate Limit' }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.deleted).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns 404 when policy not found', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [],
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/policies/pol_nonexistent',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Policy not found');
    });

    it('does not delete policy from another user\'s instance', async () => {
      mockDb._setSelectResult([]); // instance not found for this user
      const res = await app.request(
        '/api/security/instances/inst_other/policies/pol_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Gateway-auth routes (agent-facing) ──────────────────────────────

  describe('GET /api/agent/security/instances/:instanceId/policies (gateway auth)', () => {
    const gatewayHeaders = {
      'Content-Type': 'application/json',
      'X-Gateway-Token': 'gw-token-123',
      'X-Instance-Id': 'inst_1',
    };

    beforeEach(async () => {
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'gw-token-123');
    });

    it('returns active policies for the instance', async () => {
      const activePolicies = [
        { id: 'pol_1', instanceId: 'inst_1', policyType: 'network_allowlist', name: 'Allow LAN', rules: '["10.0.0.0/8"]', isActive: true },
        { id: 'pol_2', instanceId: 'inst_1', policyType: 'rate_limit', name: 'Limit API', rules: '{"max":100}', isActive: true },
      ];
      mockDb._setSelectResult(activePolicies);

      const res = await app.request(
        '/api/agent/security/instances/inst_1/policies',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policies).toHaveLength(2);
      expect(body.policies[0].id).toBe('pol_1');
      expect(body.policies[1].id).toBe('pol_2');
    });

    it('returns empty array when no active policies exist', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/agent/security/instances/inst_1/policies',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policies).toEqual([]);
    });

    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_1/policies',
        {
          headers: { 'Content-Type': 'application/json' },
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid gateway token', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_1/policies',
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'wrong-token',
            'X-Instance-Id': 'inst_1',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when instance ID in path does not match header', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_other/policies',
        {
          headers: gatewayHeaders, // X-Instance-Id is inst_1 but path is inst_other
        },
        mockEnv,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance ID mismatch');
    });
  });
});
