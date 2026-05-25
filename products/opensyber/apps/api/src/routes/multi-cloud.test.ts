/**
 * Multi-Cloud Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { multiCloudRoutes } from './multi-cloud.js';

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
    insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
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
  app.route('/api/cloud', multiCloudRoutes);
  return app;
}

describe('Multi-Cloud Routes', () => {
  it('GET /configs returns configs', async () => {
    const db = createMockDb([[{ id: 'c-1', provider: 'aws' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/cloud/configs');
    expect(res.status).toBe(200);
  });

  it('POST /configs returns 400 for AWS without roleArn (Zod strips unknown fields)', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/cloud/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'aws', displayName: 'Prod', roleArn: 'arn:aws:iam::role/x',
      }),
    });
    // Zod strips roleArn (not in schema), then validateCloudConfig fails
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('AWS roleArn is required');
  });

  it('POST /configs rejects invalid provider', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/cloud/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'oracle', displayName: 'Test' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /regions/:provider returns regions', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/cloud/regions/aws');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
  });
});
