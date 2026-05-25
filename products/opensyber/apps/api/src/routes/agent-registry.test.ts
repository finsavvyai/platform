import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
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
}));
vi.mock('../services/agent-registry.js', () => ({
  getAgentInventory: vi.fn(async () => [
    { id: 'agent1', name: 'Claude', source: 'anthropic', riskScore: 20 },
  ]),
  registerAgent: vi.fn(async (_db: any, data: any) => ({
    id: 'agent_new',
    ...data,
    createdAt: new Date().toISOString(),
  })),
  getAgentDetail: vi.fn(async (_db: any, id: string) => ({
    id,
    name: 'Test Agent',
    source: 'custom',
    riskScore: 45,
  })),
  updateAgentRisk: vi.fn(async () => undefined),
  assessAgentRisk: vi.fn((agent: any) => ({
    level: agent.riskScore > 70 ? 'high' : 'medium',
    factors: [],
  })),
  AGENT_SOURCES: ['anthropic', 'openai', 'custom'],
  AGENT_STATUS: ['active', 'inactive', 'quarantined'],
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { agentRegistryRoutes } from './agent-registry.js';

describe('Agent Registry Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };
  const json = { ...auth, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/agents', agentRegistryRoutes);
  });

  const testInvalidData = async (endpoint: string, method: string, headers: any, bodies: any[]) => {
    for (const body of bodies) {
      const res = await app.request(endpoint, { method, headers, body: JSON.stringify(body) }, mockEnv);
      expect(res.status).toBe(400);
    }
  };

  describe('GET /api/agents', () => {
    it('returns agent inventory with required fields', async () => {
      const res = await app.request('/api/agents', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((agent: any) => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('source');
        expect(agent.riskScore).toBeGreaterThanOrEqual(0);
        expect(agent.riskScore).toBeLessThanOrEqual(100);
      });
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/agents', {}, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/agents', () => {
    const validBody = { name: 'New Agent', source: 'anthropic' };

    it('registers a new agent with minimal data', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe('New Agent');
    });

    it('returns 400 when name or source missing', async () => {
      await testInvalidData('/api/agents', 'POST', json, [
        { source: 'anthropic' },
        { name: 'Agent' },
      ]);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(401);
    });

    it('accepts optional fields', async () => {
      const body = {
        ...validBody,
        owner: 'user@example.com',
        permissions: ['read'],
      };
      const res = await app.request('/api/agents', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(body),
      }, mockEnv);
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/agents/:id', () => {
    it('returns agent detail with risk profile and required fields', async () => {
      const res = await app.request('/api/agents/agent1', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.agent).toBeDefined();
      const agent = body.data.agent;
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(body.data.riskProfile).toBeDefined();
      expect(Array.isArray(body.data.riskProfile.factors)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/agents/agent1', {}, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/agents/:id/risk', () => {
    it('updates risk score with valid value', async () => {
      const res = await app.request('/api/agents/agent1/risk', {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ riskScore: 75 }),
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.newRiskScore).toBe(75);
    });

    it('validates riskScore range 0-100', async () => {
      await testInvalidData('/api/agents/agent1/risk', 'PATCH', json, [
        { riskScore: -1 },
        { riskScore: 101 },
      ]);
    });

    it('accepts boundary values 0 and 100', async () => {
      for (const score of [0, 100]) {
        const res = await app.request('/api/agents/agent1/risk', {
          method: 'PATCH',
          headers: json,
          body: JSON.stringify({ riskScore: score }),
        }, mockEnv);
        expect(res.status).toBe(200);
      }
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/agents/agent1/risk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskScore: 75 }),
      }, mockEnv);
      expect(res.status).toBe(401);
    });
  });
});
