import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../../test/helpers.js';

vi.mock('../../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role: 'admin' } : null);
    await next();
  },
}));

// Mock the attack-path services
const mockGraph = new Map();
vi.mock('../../services/attack-path/index.js', () => ({
  loadOrgGraph: vi.fn(async () => mockGraph),
  bfsTraverse: vi.fn(() => ({ reachable: new Map() })),
  computeBlastRadius: vi.fn(() => ({
    score: 42, totalReachable: 3, crownJewelsReached: 1,
    byType: { file: 2, database: 1 }, bySensitivity: { critical: 1, medium: 2 },
  })),
  findCrownJewelPaths: vi.fn(() => ({ paths: [], totalCrownJewels: 0 })),
}));

vi.stubGlobal('fetch', mockAuthFetch());

import { attackPathRoutes } from './index.js';

describe('Attack Path Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer tok' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    mockGraph.clear();
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/attack-paths', attackPathRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/attack-paths/crown-jewels', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('POST /api/attack-paths/query', () => {
    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/attack-paths/query', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryAssetId: 'a1' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing entryAssetId', async () => {
      const res = await app.request('/api/attack-paths/query', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify({}),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 404 when entry asset not in graph', async () => {
      // mockGraph is empty, so entryAssetId won't be found
      const res = await app.request('/api/attack-paths/query', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ entryAssetId: 'missing' }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('returns blast radius data when entry exists', async () => {
      mockGraph.set('entry-1', { id: 'entry-1', edges: [] });
      const res = await app.request('/api/attack-paths/query', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ entryAssetId: 'entry-1' }),
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.entryAssetId).toBe('entry-1');
      expect(body.data.blastRadius.score).toBe(42);
    });

    it('validates maxDepth range', async () => {
      const res = await app.request('/api/attack-paths/query', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ entryAssetId: 'a1', maxDepth: 100 }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/attack-paths/blast-radius/:sessionId', () => {
    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/attack-paths/blast-radius/s1', {
        headers: auth,
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 404 when session asset not found', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/attack-paths/blast-radius/missing', {
        headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('returns blast radius for valid session', async () => {
      mockDb._setSelectResults([[{ id: 's1', assetType: 'agent_session' }]]);
      const res = await app.request('/api/attack-paths/blast-radius/s1', {
        headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.sessionId).toBe('s1');
      expect(body.data.score).toBe(42);
    });
  });

  describe('GET /api/attack-paths/crown-jewels', () => {
    it('returns empty when no orgId', async () => {
      const res = await app.request('/api/attack-paths/crown-jewels', {
        headers: auth,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it('returns crown jewels for org', async () => {
      mockDb._setSelectResults([[
        { id: 'cj1', name: 'Production DB', isCrownJewel: true },
        { id: 'cj2', name: 'Customer PII', isCrownJewel: true },
      ]]);
      const res = await app.request('/api/attack-paths/crown-jewels', {
        headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
    });
  });
});
