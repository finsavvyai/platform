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

import { marketplaceRateRoutes } from './marketplace-rate.js';

describe('Marketplace Rate Routes', () => {
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
    app.route('/api/marketplace', marketplaceRateRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    }, mockEnv);
    expect(res.status).toBe(401);
  });

  it('rejects invalid rating below 1', async () => {
    mockDb._setSelectResults([]);
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 0 }),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('rejects invalid rating above 5', async () => {
    mockDb._setSelectResults([]);
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 6 }),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent skill', async () => {
    mockDb._setSelectResults([[]]);
    const res = await app.request('/api/marketplace/s-missing/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4 }),
    }, mockEnv);
    expect(res.status).toBe(404);
  });

  it('creates new rating for skill', async () => {
    // First select: find skill, second: find existing rating, third: aggregate
    mockDb._setSelectResults([
      [{ id: 's-1', name: 'Test Skill' }],
      [],
      [{ avgRating: 4, totalCount: 1 }],
    ]);
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4, review: 'Great skill' }),
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.rating).toBe(4);
    expect(body.data.review).toBe('Great skill');
  });

  it('updates existing rating', async () => {
    mockDb._setSelectResults([
      [{ id: 's-1', name: 'Test Skill' }],
      [{ id: 'r-1', skillId: 's-1', userId: 'user_test123', rating: 3, review: 'OK' }],
      [{ avgRating: 5, totalCount: 1 }],
    ]);
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('lists ratings for a skill', async () => {
    mockDb._setSelectResults([[
      { id: 'r-1', skillId: 's-1', rating: 5, review: 'Excellent' },
      { id: 'r-2', skillId: 's-1', rating: 4, review: 'Good' },
    ]]);
    const res = await app.request('/api/marketplace/s-1/ratings', {
      headers: auth,
    }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(2);
  });

  it('rejects rating without body', async () => {
    const res = await app.request('/api/marketplace/s-1/rate', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, mockEnv);
    expect(res.status).toBe(400);
  });
});
