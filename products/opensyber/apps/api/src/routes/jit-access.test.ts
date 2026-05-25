/**
 * JIT Access Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { jitAccessRoutes } from './jit-access.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb(results: unknown[] = []) {
  let idx = 0;
  const updateFn = vi.fn(async () => ({}));
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(results[idx++] ?? []),
      }),
    }),
    insert: () => ({ values: vi.fn(async () => ({})) }),
    update: () => ({
      set: () => ({
        where: updateFn,
      }),
    }),
  };
}

function createTestApp(db: ReturnType<typeof createMockDb>) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1');
    c.set('orgId' as never, 'org-1');
    c.set('db' as never, db);
    await next();
  });
  app.route('/api/vault', jitAccessRoutes);
  return app;
}

describe('JIT Access Routes', () => {
  it('GET /jit-requests lists requests', async () => {
    const db = createMockDb([[{ id: 'jit-1', status: 'pending' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/jit-requests');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /jit-requests creates a request', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/jit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretId: 'sec-1', reason: 'Deploy fix', durationMinutes: 30 }),
    });
    expect(res.status).toBe(201);
  });

  it('PATCH /jit-requests/:id/approve approves pending', async () => {
    const db = createMockDb([[{ id: 'jit-1', status: 'pending', durationMinutes: 60 }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/jit-requests/jit-1/approve', { method: 'PATCH' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.approved).toBe(true);
  });

  it('PATCH /jit-requests/:id/deny denies pending', async () => {
    const db = createMockDb([[{ id: 'jit-2', status: 'pending' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/jit-requests/jit-2/deny', { method: 'PATCH' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.denied).toBe(true);
  });
});
