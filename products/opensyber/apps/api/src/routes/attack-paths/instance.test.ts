import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../../test/helpers.js';

vi.mock('../../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as { __mockDb?: unknown }).__mockDb),
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test');
    await next();
  },
}));

vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test', role: 'admin' } : null);
    await next();
  },
}));

// Mock the attack-path services — we only care that the route wires them
// together with correct parameters.
const mockGraph = new Map();
const bfsSpy = vi.fn();
const buildVizSpy = vi.fn();
const rankSpy = vi.fn();
const blastSpy = vi.fn();

vi.mock('../../services/attack-path/index.js', () => ({
  loadOrgGraph: vi.fn(async () => mockGraph),
  bfsTraverse: (...args: unknown[]) => bfsSpy(...args),
  computeBlastRadius: (...args: unknown[]) => blastSpy(...args),
  buildVizGraph: (...args: unknown[]) => buildVizSpy(...args),
  rankAttackPaths: (...args: unknown[]) => rankSpy(...args),
  findCrownJewelPaths: vi.fn(() => ({ paths: [], totalCrownJewels: 0 })),
}));

vi.stubGlobal('fetch', mockAuthFetch());

// Import AFTER mocks.
import { attackPathRoutes } from './index.js';

describe('GET /api/attack-paths/graph/:instanceId', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer tok' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGraph.clear();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as { __mockDb?: unknown }).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());

    bfsSpy.mockReturnValue({ reachable: new Map() });
    blastSpy.mockReturnValue({
      score: 58,
      totalReachable: 3,
      crownJewelsReached: 1,
      byType: { file: 2, database: 1 },
      bySensitivity: { critical: 1, medium: 2 },
    });
    buildVizSpy.mockReturnValue({
      nodes: [
        { id: 'asset-1', label: 'Cursor Session', type: 'entry' },
        { id: 'asset-2', label: 'AWS Creds', type: 'vulnerability', severity: 'high' },
      ],
      edges: [{ source: 'asset-1', target: 'asset-2', weight: 0.9, label: 'read_access' }],
    });
    rankSpy.mockReturnValue([
      { targetId: 'asset-2', targetName: 'AWS Creds', hops: 1, path: ['asset-1', 'asset-2'], maxSeverityWeight: 3, riskScore: 12 },
    ]);

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/attack-paths', attackPathRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/attack-paths/graph/inst-1', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('returns 400 without org context', async () => {
    const res = await app.request(
      '/api/attack-paths/graph/inst-1',
      { headers: auth },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when no matching asset found', async () => {
    mockDb._setSelectResult([]);
    const res = await app.request(
      '/api/attack-paths/graph/inst-missing',
      { headers: org },
      mockEnv,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('inst-missing');
  });

  it('returns 404 when entry asset resolves but is absent from the graph', async () => {
    mockDb._setSelectResult([
      { id: 'asset-1', orgId: 'org_test', assetType: 'agent_session' },
    ]);
    mockGraph.clear(); // graph has no matching node
    const res = await app.request(
      '/api/attack-paths/graph/asset-1',
      { headers: org },
      mockEnv,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('missing from graph');
  });

  it('returns nodes, edges, riskScore and rankedPaths on success', async () => {
    mockDb._setSelectResult([
      { id: 'asset-1', orgId: 'org_test', assetType: 'agent_session', identifier: 'inst-1', name: 'Cursor Session' },
    ]);
    mockGraph.set('asset-1', {
      id: 'asset-1',
      name: 'Cursor Session',
      assetType: 'agent_session',
      identifier: 'inst-1',
      sensitivity: 'medium',
      isCrownJewel: false,
      edges: [],
    });

    const res = await app.request(
      '/api/attack-paths/graph/inst-1',
      { headers: org },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        instanceId: string;
        entryAssetId: string;
        nodes: unknown[];
        edges: unknown[];
        riskScore: number;
        rankedPaths: unknown[];
      };
    };

    expect(body.data.instanceId).toBe('inst-1');
    expect(body.data.entryAssetId).toBe('asset-1');
    expect(body.data.nodes).toHaveLength(2);
    expect(body.data.edges).toHaveLength(1);
    expect(body.data.riskScore).toBe(58);
    expect(body.data.rankedPaths).toHaveLength(1);

    // Confirm the service layer was invoked with the resolved asset id.
    expect(bfsSpy).toHaveBeenCalledWith(mockGraph, 'asset-1');
    expect(buildVizSpy).toHaveBeenCalled();
    expect(rankSpy).toHaveBeenCalled();
  });
});
