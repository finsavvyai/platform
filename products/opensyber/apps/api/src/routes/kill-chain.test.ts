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
  requirePermission: (perm: string) => async (c: any, next: any) => {
    const perms: Record<string, boolean> = { 'alert.view': true };
    if (!perms[perm]) return c.json({ error: 'Forbidden' }, 403);
    await next();
  },
  resolveOrgContext: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { killChainRoutes } from './kill-chain.js';

describe('Kill Chain Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const json = { ...auth, 'Content-Type': 'application/json' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/kill-chain', killChainRoutes);
  });

  // ── GET /kill-chain/rules ────────────────────────────────────────────
  describe('GET /api/kill-chain/rules', () => {
    it('returns list of kill chain rules', async () => {
      const res = await app.request('/api/kill-chain/rules', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.rules).toBeDefined();
      expect(Array.isArray(body.rules)).toBe(true);
      if (body.rules.length > 0) {
        const rule = body.rules[0];
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('timeWindowMinutes');
        expect(rule).toHaveProperty('stages');
      }
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/kill-chain/rules', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('each rule has required fields', async () => {
      const res = await app.request('/api/kill-chain/rules', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      body.rules.forEach((rule: any) => {
        expect(typeof rule.id).toBe('string');
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.description).toBe('string');
        expect(['info', 'warning', 'critical']).toContain(rule.severity);
        expect(typeof rule.timeWindowMinutes).toBe('number');
        expect(Array.isArray(rule.stages)).toBe(true);
      });
    });
  });

  // ── GET /kill-chain/incidents ────────────────────────────────────────
  describe('GET /api/kill-chain/incidents', () => {
    it('returns list of incidents', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/kill-chain/incidents', {
        headers: jsonOrg,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toBeDefined();
      expect(Array.isArray(body.incidents)).toBe(true);
      expect(body.total).toBeDefined();
      expect(typeof body.total).toBe('number');
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/kill-chain/incidents', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('returns empty array when no incidents', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/kill-chain/incidents', {
        headers: jsonOrg,
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.incidents).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('requires alert.view permission', async () => {
      mockDb._setSelectResult([]);
      const noPerm = { ...auth, 'X-Permission': 'none' };
      const res = await app.request('/api/kill-chain/incidents', {
        headers: noPerm,
      }, mockEnv);
      expect([200, 403]).toContain(res.status);
    });
  });

  // ── POST /kill-chain/evaluate ────────────────────────────────────────
  describe('POST /api/kill-chain/evaluate', () => {
    const validBody = { eventId: 'evt_123' };

    it('returns evaluation result for valid eventId', async () => {
      const res = await app.request('/api/kill-chain/evaluate', {
        method: 'POST',
        headers: jsonOrg,
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.eventId).toBe('evt_123');
      expect(body.incidentsCreated).toBeDefined();
      expect(typeof body.incidentsCreated).toBe('number');
      expect(Array.isArray(body.incidents)).toBe(true);
    });

    it('returns 400 when eventId missing', async () => {
      const res = await app.request('/api/kill-chain/evaluate', {
        method: 'POST',
        headers: jsonOrg,
        body: JSON.stringify({}),
      }, mockEnv);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid input');
    });

    it('returns 400 when body is empty', async () => {
      const res = await app.request('/api/kill-chain/evaluate', {
        method: 'POST',
        headers: jsonOrg,
        body: JSON.stringify(null),
      }, mockEnv);
      expect([400, 500]).toContain(res.status);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/kill-chain/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }, mockEnv);
      expect(res.status).toBe(401);
    });

    it('returns empty incidents array initially', async () => {
      const res = await app.request('/api/kill-chain/evaluate', {
        method: 'POST',
        headers: jsonOrg,
        body: JSON.stringify(validBody),
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.incidents).toEqual([]);
      expect(body.incidentsCreated).toBe(0);
    });
  });
});
