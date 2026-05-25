/**
 * SOC2 Evidence Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { soc2EvidenceRoutes } from './soc2-evidence.js';

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
    insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
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
  app.route('/api/soc2', soc2EvidenceRoutes);
  return app;
}

describe('SOC2 Evidence Routes', () => {
  it('GET /evidence returns evidence items', async () => {
    const db = createMockDb([[{ id: 'ev-1', title: 'Logs' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/soc2/evidence');
    expect(res.status).toBe(200);
  });

  it('POST /evidence creates evidence', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/soc2/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlId: 'OASF-01', tsc: 'CC7.2',
        evidenceType: 'log', title: 'Agent Activity Logs',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('GET /evidence/auto-collect returns platform evidence', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/soc2/evidence/auto-collect');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(5);
    expect(body.data.summary.coveragePercent).toBeGreaterThan(0);
  });
});
