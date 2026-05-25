/**
 * AI Insights Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { aiInsightRoutes } from './ai-insights.js';

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
    update: () => ({
      set: () => ({
        where: vi.fn(async () => ({})),
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
  app.route('/api/ai', aiInsightRoutes);
  return app;
}

describe('AI Insights Routes', () => {
  it('GET /insights returns insights', async () => {
    const db = createMockDb([[{ id: 'ins-1', title: 'Test Insight' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/ai/insights');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /insights creates an insight', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'security', severity: 'high',
        title: 'Suspicious Activity', description: 'Agent accessed prod secrets',
        sourceType: 'agent_activity',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('PATCH /insights/:id updates status', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/ai/insights/ins-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(res.status).toBe(200);
  });

  it('POST /compliance-narrative generates narrative', async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);
    const res = await app.request('/api/ai/compliance-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controls: [
          { controlId: 'OASF-01', name: 'Logging', status: 'pass', evidenceCount: 5 },
          { controlId: 'OASF-02', name: 'Access', status: 'fail', evidenceCount: 0 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.overallScore).toBe(50);
    expect(body.data.grade).toBe('D');
  });
});
