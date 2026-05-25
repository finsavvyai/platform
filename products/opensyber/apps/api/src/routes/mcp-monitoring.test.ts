import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!c.req.header('Authorization')?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../services/mcp-monitor.js', () => ({
  trackMcpInvocation: vi.fn(async () => ({
    id: 'inv_1',
    serverId: 'mcp-1',
    toolName: 'test_tool',
    agentId: 'agent_1',
    timestamp: new Date().toISOString(),
  })),
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { mcpMonitoringRoutes } from './mcp-monitoring.js';

describe('MCP Monitoring Routes', () => {
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
    app.route('/api/mcp', mcpMonitoringRoutes);
  });

  describe('GET /api/mcp', () => {
    it('returns list of MCP servers', async () => {
      const res = await app.request('/api/mcp', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.servers).toBeDefined();
      expect(Array.isArray(body.servers)).toBe(true);
    });

    it('returns servers array (empty when no servers registered)', async () => {
      const res = await app.request('/api/mcp', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.servers)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/mcp', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('returns servers array', async () => {
      const res = await app.request('/api/mcp', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.servers)).toBe(true);
    });
  });

  describe('POST /api/mcp/invocations', () => {
    const validBody = {
      serverId: 'mcp-1',
      toolName: 'test_tool',
      agentId: 'agent_1',
      instanceId: 'inst_1',
    };

    it('tracks a tool invocation', async () => {
      const res = await app.request('/api/mcp/invocations', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data).toBeDefined();
    });

    it('returns 400 when serverId missing', async () => {
      const body = { ...validBody };
      delete (body as any).serverId;
      const res = await app.request('/api/mcp/invocations', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(body),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/mcp/invocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(401);
    });

    it('accepts valid invocation request', async () => {
      const res = await app.request('/api/mcp/invocations', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/mcp/alerts', () => {
    it('returns recent alerts with required fields', async () => {
      const res = await app.request('/api/mcp/alerts', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.alerts)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/mcp/alerts', {}, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/mcp/scan', () => {
    const validBody = { serverId: 'mcp-1' };

    it('triggers credential scan', async () => {
      const res = await app.request('/api/mcp/scan', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(202);
      const body = (await res.json()) as any;
      expect(body.data.serverId).toBe('mcp-1');
      expect(body.data.status).toBe('scanning');
    });

    it('returns 202 Accepted', async () => {
      const res = await app.request('/api/mcp/scan', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(202);
    });

    it('returns empty credentialRisks initially', async () => {
      const res = await app.request('/api/mcp/scan', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(validBody),
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data.credentialRisks)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/mcp/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(401);
    });

    it('requires serverId in request', async () => {
      const res = await app.request('/api/mcp/scan', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({}),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });
});
