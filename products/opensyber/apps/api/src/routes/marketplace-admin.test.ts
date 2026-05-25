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

import { marketplaceAdminRoutes } from './marketplace-admin.js';

describe('Marketplace Admin Routes', () => {
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
    app.route('/api/admin/marketplace', marketplaceAdminRoutes);
  });

  it('lists submissions', async () => {
    mockDb._setSelectResults([[{ id: 'sub-1', status: 'pending' }]]);
    const res = await app.request('/api/admin/marketplace/submissions', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('approves submission', async () => {
    mockDb._setSelectResults([
      [{ id: 'sub-1', skillId: 's-1', versionId: 'v-1', status: 'pending' }],
      [{
        id: 's-1',
        manifest: JSON.stringify({
          sbom: { artifact: { checksum: 'sha256:abc123' } },
          signature: { provider: 'sigstore', bundle: 'bundle-json', verified: true },
        }),
      }],
      [{ id: 'v-1', checksum: 'sha256:abc123' }],
    ]);
    const res = await app.request('/api/admin/marketplace/submissions/sub-1', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ action: 'approve' }),
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('approved');
  });

  it('blocks approval for unsigned artifacts', async () => {
    mockDb._setSelectResults([
      [{ id: 'sub-1', skillId: 's-1', versionId: 'v-1', status: 'pending' }],
      [{
        id: 's-1',
        manifest: JSON.stringify({ sbom: { artifact: { checksum: 'sha256:abc123' } }, signature: null }),
      }],
      [{ id: 'v-1', checksum: 'sha256:abc123' }],
    ]);
    const res = await app.request('/api/admin/marketplace/submissions/sub-1', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ action: 'approve' }),
    }, mockEnv);
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error).toContain('trust policy');
    expect(body.code).toBe('MISSING_SIGNATURE');
  });

  it('rejects submission', async () => {
    mockDb._setSelectResults([[{ id: 'sub-1', skillId: 's-1' }]]);
    const res = await app.request('/api/admin/marketplace/submissions/sub-1', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ action: 'reject', notes: 'Not secure' }),
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe('rejected');
  });

  it('validates action field', async () => {
    const res = await app.request('/api/admin/marketplace/submissions/sub-1', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ action: 'invalid' }),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing submission', async () => {
    mockDb._setSelectResults([[]]);
    const res = await app.request('/api/admin/marketplace/submissions/missing', {
      method: 'PATCH', headers: json,
      body: JSON.stringify({ action: 'approve' }),
    }, mockEnv);
    expect(res.status).toBe(404);
  });

  it('toggles featured status', async () => {
    mockDb._setSelectResults([[{ id: 's-1', isFeatured: false }]]);
    const res = await app.request('/api/admin/marketplace/skills/s-1/featured', {
      method: 'PATCH', headers: auth,
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.isFeatured).toBe(true);
  });
});
