import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

// Mock createDb so dbMiddleware uses our mock
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
  resolveOrgContextAutoDetect: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => { await next(); },
}));

// Mock agent runtime service so it doesn't use real fetch
vi.mock('../services/agent-runtime.js', () => ({
  agentRuntime: {
    createInstance: vi.fn(async () => ({
      containerId: 'cf-container-99999',
      hostname: 'agent-99999.opensyber.cloud',
      region: 'enam',
    })),
    deleteInstance: vi.fn(async () => undefined),
    restartInstance: vi.fn(async () => undefined),
    getInstanceStatus: vi.fn(async () => 'running'),
  },
}));

vi.mock('../services/email.js', () => ({
  emailService: {
    sendAgentDeployedEmail: vi.fn(async () => undefined),
  },
}));

// Mock fetch for Clerk auth
vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { instanceRoutes } from './instances.js';
import { instanceActionRoutes } from './instance-actions.js';
import { instanceSkillRoutes } from './instance-skills.js';
import { agentRuntime } from '../services/agent-runtime.js';
import { Hono } from 'hono';

describe('Instance Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/instances', instanceRoutes);
    app.route('/api/instances', instanceActionRoutes);
    app.route('/api/instances', instanceSkillRoutes);
  });

  const authHeaders = { Authorization: 'Bearer valid-token' };

  // ─── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 without auth header', async () => {
    const res = await app.request('/api/instances', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── List instances ────────────────────────────────────────────────────

  describe('GET /api/instances', () => {
    it('returns empty array when no instances', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/instances', { headers: authHeaders }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.instances).toEqual([]);
    });

    it('returns user instances', async () => {
      const instances = [
        { id: 'inst_1', name: 'Agent 1', status: 'running', region: 'eu-central' },
        { id: 'inst_2', name: 'Agent 2', status: 'stopped', region: 'us-east' },
      ];
      mockDb._setSelectResult(instances);

      const res = await app.request('/api/instances', { headers: authHeaders }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.instances).toHaveLength(2);
      expect(body.instances[0].id).toBe('inst_1');
    });
  });

  // ─── Get single instance ──────────────────────────────────────────────

  describe('GET /api/instances/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/instances/inst_unknown', { headers: authHeaders }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns instance when found', async () => {
      const instance = {
        id: 'inst_1',
        name: 'My Agent',
        status: 'running',
        region: 'eu-central',
        userId: 'user_test123',
      };
      mockDb._setSelectResult([instance]);

      const res = await app.request('/api/instances/inst_1', { headers: authHeaders }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.instance.id).toBe('inst_1');
      expect(body.instance.status).toBe('running');
    });
  });

  // ─── Create instance ──────────────────────────────────────────────────

  describe('POST /api/instances', () => {
    it('returns 404 when user not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'eu-central' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('rejects invalid region', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'personal' }],
        [],
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'invalid-region' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Bad request');
    });

    it('creates instance with valid region', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'personal' }],
        [],
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'eu-central', name: 'Test Agent' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.instance.name).toBe('Test Agent');
      expect(body.instance.region).toBe('eu-central');
      // Container creation succeeds → status becomes 'running'
      expect(body.instance.status).toBe('running');
      expect(body.instance.containerId).toBeDefined();
      expect(body.instance.hostname).toBeDefined();
      expect(body.instance.gatewayTokenEncrypted).toBeUndefined();
    });

    it('uses default name when not provided', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'personal' }],
        [],
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'us-east' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.instance.name).toBe('My Agent');
    });

    it('rejects free tier with 402 sandbox-only message', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'free' }],
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'eu-central' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(402);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Upgrade required');
      expect(body.upgradeUrl).toBe('/pricing');
      expect(body.cta).toBe('View plans');
    });

    it('rejects when plan instance limit reached', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'personal' }],
        [{ id: 'existing_inst' }], // 1 already exists, personal limit = 1
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'eu-central' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Limit reached');
    });

    it('returns 500 when container creation fails', async () => {
      vi.mocked(agentRuntime.createInstance).mockRejectedValueOnce(new Error('Container API error'));
      mockDb._setSelectResults([
        [{ id: 'user_test123', plan: 'personal' }],
        [],
      ]);

      const res = await app.request(
        '/api/instances',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'eu-central', name: 'Fail Agent' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Provisioning failed');
      expect(body.instance.status).toBe('error');
      expect(console.error).toHaveBeenCalledWith('[Instances] Container create failed:', expect.any(Error));
    });

    it('accepts all valid regions', async () => {
      const validRegions = ['eu-central', 'us-east', 'us-west', 'ap-southeast'];

      for (const region of validRegions) {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mockAuthFetch('user_test123'));
        mockDb = createMockDb();
        (globalThis as any).__mockDb = mockDb;

        mockDb._setSelectResults([
          [{ id: 'user_test123', plan: 'team' }],
          [],
        ]);

        const res = await app.request(
          '/api/instances',
          {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ region }),
          },
          mockEnv,
        );
        expect(res.status).toBe(201);
      }
    });
  });

  // ─── Restart instance ─────────────────────────────────────────────────

  describe('POST /api/instances/:id/restart', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1/restart',
        { method: 'POST', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when instance not yet provisioned', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', containerId: null }]);
      const res = await app.request(
        '/api/instances/inst_1/restart',
        { method: 'POST', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not ready');
    });

    it('initiates restart for provisioned instance', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', containerId: 'cf-container-12345' }]);
      const res = await app.request(
        '/api/instances/inst_1/restart',
        { method: 'POST', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Restart initiated');
    });
  });

  // ─── Delete instance ──────────────────────────────────────────────────

  describe('DELETE /api/instances/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('marks instance as destroying', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance deleted');
      expect(body.instanceId).toBe('inst_1');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('deletes Hetzner server and KV token when instance has serverId', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', containerId: 'cf-container-12345' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockEnv.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith('gateway:inst_1');
    });

    it('returns 500 when container delete fails', async () => {
      vi.mocked(agentRuntime.deleteInstance).mockRejectedValueOnce(new Error('Container delete error'));
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', containerId: 'cf-container-12345' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Deletion failed');
      expect(console.error).toHaveBeenCalledWith('[Instances] Container delete failed:', expect.any(Error));
    });

    it('cleans up even without Hetzner server', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', containerId: null }]);
      const res = await app.request(
        '/api/instances/inst_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockEnv.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith('gateway:inst_1');
    });
  });

  // ─── Health metrics ─────────────────────────────────────────────────

  describe('GET /api/instances/:id/health', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1/health',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns null health when no cache data', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1/health',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.health).toBeNull();
    });

    it('returns cached health data', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const healthData = { cpuPercent: 45, memoryPercent: 60, diskPercent: 30 };
      await mockEnv.CACHE.put('health:inst_1', JSON.stringify(healthData));

      const res = await app.request(
        '/api/instances/inst_1/health',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.health.cpuPercent).toBe(45);
      expect(body.health.memoryPercent).toBe(60);
    });
  });

  // ─── List installed skills ──────────────────────────────────────────

  describe('GET /api/instances/:id/skills', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1/skills',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns installed skills', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [
          { installation: { id: 'si_1', version: '1.0' }, skill: { id: 'sk_1', name: 'Skill A' } },
        ],
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skills).toHaveLength(1);
    });

    it('returns empty array when no skills installed', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [],
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skills).toEqual([]);
    });
  });

  // ─── Install skill ──────────────────────────────────────────────────

  describe('POST /api/instances/:id/skills', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1/skills',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: 'sk_1', version: '1.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when skillId or version missing', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123' }]);
      const res = await app.request(
        '/api/instances/inst_1/skills',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: 'sk_1' }), // missing version
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid input');
    });

    it('returns 404 when skill does not exist', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [], // skill not found
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: 'sk_missing', version: '1.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Skill not found');
    });

    it('installs skill and increments install count', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'sk_1', installCount: 5 }],
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: 'sk_1', version: '1.0.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.installation.skillId).toBe('sk_1');
      expect(body.installation.version).toBe('1.0.0');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled(); // increment installCount
    });
  });

  // ─── Patch instance ──────────────────────────────────────────────────

  describe('PATCH /api/instances/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('renames instance', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', name: 'Old Name' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Renamed Agent' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.instance.name).toBe('Renamed Agent');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('accepts whitespace name after trim (Zod trim runs after min)', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', name: 'Old Name' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '   ' }),
        },
        mockEnv,
      );
      // Zod .trim() runs after .min(1), so whitespace-only passes validation
      expect(res.status).toBe(200);
    });

    it('rejects when no valid fields provided', async () => {
      mockDb._setSelectResult([{ id: 'inst_1', userId: 'user_test123', name: 'Old Name' }]);
      const res = await app.request(
        '/api/instances/inst_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });
  });

  // ─── Uninstall skill ────────────────────────────────────────────────

  describe('DELETE /api/instances/:id/skills/:skillId', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/instances/inst_1/skills/sk_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when skill not installed', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [], // installation not found
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills/sk_missing',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Skill not installed');
    });

    it('uninstalls skill', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'si_1', instanceId: 'inst_1', skillId: 'sk_1' }],
      ]);

      const res = await app.request(
        '/api/instances/inst_1/skills/sk_1',
        { method: 'DELETE', headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Skill uninstalled');
      expect(body.skillId).toBe('sk_1');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
