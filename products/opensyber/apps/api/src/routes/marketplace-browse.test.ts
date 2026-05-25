import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { marketplaceBrowseRoutes } from './marketplace-browse.js';

describe('Marketplace Browse Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer tok' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/marketplace', marketplaceBrowseRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/marketplace', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('lists marketplace skills', async () => {
    mockDb._setSelectResults([[
      {
        id: 's-1',
        name: 'Test Skill',
        slug: 'test-skill',
        category: 'security',
        manifest: JSON.stringify({
          sbom: { artifact: { checksum: 'sha256:abc123' } },
          signature: { provider: 'sigstore', bundle: 'bundle-json', verified: true },
        }),
      },
    ]]);
    const res = await app.request('/api/marketplace', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].isSigned).toBe(true);
    expect(body.data[0].hasSbom).toBe(true);
  });

  it('returns featured skills', async () => {
    mockDb._setSelectResults([[
      { id: 's-1', name: 'Featured', isFeatured: true },
    ]]);
    const res = await app.request('/api/marketplace/featured', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('returns skill detail', async () => {
    mockDb._setSelectResults([[{ id: 's-1', name: 'Test' }]]);
    const res = await app.request('/api/marketplace/s-1', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('returns 404 for missing skill', async () => {
    mockDb._setSelectResults([[]]);
    const res = await app.request('/api/marketplace/missing', { headers: auth }, mockEnv);
    expect(res.status).toBe(404);
  });
});
