/**
 * AI Query Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { aiQueryRoutes } from './ai-query.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb() {
  return {
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
  app.route('/api/ai', aiQueryRoutes);
  return app;
}

describe('AI Query Routes', () => {
  it('POST /query translates NL to filter', async () => {
    const db = createMockDb();
    const app = createTestApp(db);
    const res = await app.request('/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'show me critical cursor activity last week' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.filter.riskLevel).toBe('critical');
    expect(body.data.filter.agentName).toBe('cursor');
    expect(body.data.description).toContain('risk level');
  });

  it('POST /query returns 400 without query', async () => {
    const db = createMockDb();
    const app = createTestApp(db);
    const res = await app.request('/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
