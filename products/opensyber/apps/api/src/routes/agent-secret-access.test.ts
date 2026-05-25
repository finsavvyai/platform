/**
 * Agent Secret Access Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { agentSecretAccessRoutes } from './agent-secret-access.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb(results: unknown[] = []) {
  let idx = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(results[idx++] ?? []),
          }),
        }),
      }),
    }),
    insert: () => ({ values: vi.fn(async () => ({})) }),
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
  app.route('/api/agents', agentSecretAccessRoutes);
  return app;
}

describe('Agent Secret Access Routes', () => {
  it('GET /secret-access returns records', async () => {
    const records = [{ id: 'acc-1', agentId: 'a1', secretName: 'AWS_KEY' }];
    const db = createMockDb([records]);
    const app = createTestApp(db);
    const res = await app.request('/api/agents/secret-access');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('GET /secret-access/:agentId filters by agent', async () => {
    const db = createMockDb([[{ id: 'acc-2', agentId: 'agent-1' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/agents/secret-access/agent-1');
    expect(res.status).toBe(200);
  });

  it('POST /secret-access logs access', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/agents/secret-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'agent-1', secretName: 'DB_PASS', accessType: 'read' }),
    });
    expect(res.status).toBe(201);
  });
});
