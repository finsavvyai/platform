/**
 * Vault Rotation Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { vaultRotationRoutes } from './vault-rotation.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb(results: unknown[] = []) {
  let idx = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(results[idx++] ?? []),
      }),
    }),
    insert: () => ({ values: vi.fn(async () => ({})) }),
    delete: () => ({ where: vi.fn(async () => ({})) }),
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
  app.route('/api/vault', vaultRotationRoutes);
  return app;
}

describe('Vault Rotation Routes', () => {
  it('GET /rotation-policies returns policies', async () => {
    const db = createMockDb([[{ id: 'pol-1', secretPattern: 'AWS_*' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/rotation-policies');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /rotation-policies creates a policy', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/rotation-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretPattern: 'DB_*', rotationIntervalDays: 30 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeDefined();
  });

  it('DELETE /rotation-policies/:id deletes', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/vault/rotation-policies/pol-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
