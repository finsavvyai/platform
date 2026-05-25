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

import { marketplacePublishRoutes } from './marketplace-publish.js';

describe('Marketplace Publish Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer tok' };
  const json = { ...auth, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/marketplace', marketplacePublishRoutes);
  });

  it('publishes a new skill', async () => {
    const res = await app.request('/api/marketplace/publish', {
      method: 'POST', headers: json,
      body: JSON.stringify({
        name: 'My Skill',
        slug: 'my-skill',
        category: 'security',
        version: '1.0.0',
        artifact: {
          checksum: 'sha256:abc123',
          fileSize: 2048,
          signature: { provider: 'sigstore', bundle: 'bundle-json', verified: true },
        },
      }),
    }, mockEnv);
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.skillId).toBeDefined();
    expect(mockDb.insert).toHaveBeenCalledTimes(3); // skill + version + submission
    const firstInsert = mockDb._insertChain.values.mock.calls[0]?.[0];
    expect(firstInsert.manifest).toBeDefined();
    const parsedManifest = JSON.parse(firstInsert.manifest);
    expect(parsedManifest.sbom.artifact.checksum).toBe('sha256:abc123');
    expect(parsedManifest.signature.provider).toBe('sigstore');
  });

  it('validates required fields', async () => {
    const res = await app.request('/api/marketplace/publish', {
      method: 'POST', headers: json,
      body: JSON.stringify({ name: 'No Version' }),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('lists publisher skills', async () => {
    mockDb._setSelectResults([[{ id: 's-1', name: 'My Skill' }]]);
    const res = await app.request('/api/marketplace/my-skills', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('updates own skill metadata', async () => {
    mockDb._setSelectResults([[{ id: 's-1', publisherId: 'user_test123' }]]);
    const res = await app.request('/api/marketplace/my-skills/s-1', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ name: 'Updated' }),
    }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-owned skill', async () => {
    mockDb._setSelectResults([[]]);
    const res = await app.request('/api/marketplace/my-skills/missing', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ name: 'Updated' }),
    }, mockEnv);
    expect(res.status).toBe(404);
  });
});
