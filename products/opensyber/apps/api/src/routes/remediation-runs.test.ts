/**
 * Remediation Run Routes Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../middleware/db.js', () => ({ dbMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()) }));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requirePermission: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

// Mock the step runner so route tests don't need full infra context
vi.mock('../services/playbook-steps.js', () => ({
  runStepAction: vi.fn(async (step: { name: string }) =>
    `${step.name} executed`,
  ),
}));

import { remediationRunRoutes } from './remediation-runs.js';

vi.stubGlobal('fetch', vi.fn(async () =>
  new Response(JSON.stringify({ keys: [{ id: 'key_test' }] })),
));

function createMockDb(results: unknown[] = []) {
  let idx = 0;
  const getResult = () => {
    const r = results[idx++] ?? [];
    return Array.isArray(r) ? r : [];
  };
  return {
    select: () => ({
      from: () => ({
        where: () => {
          const data = getResult();
          const thenResult = Promise.resolve(data);
          return Object.assign(thenResult, {
            orderBy: () => ({
              limit: () => Promise.resolve(data),
            }),
          });
        },
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
  app.route('/api/remediation', remediationRunRoutes);
  return app;
}

describe('Remediation Run Routes', () => {
  it('GET /runs lists runs', async () => {
    const db = createMockDb([[{ id: 'run-1', status: 'completed' }]]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/runs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /runs executes a playbook', async () => {
    const steps = JSON.stringify([
      { name: 'Suspend', type: 'suspend_agent', config: { agentId: 'a-1' } },
    ]);
    const db = createMockDb([
      [{ id: 'pb-1', orgId: 'org-1', steps }],
    ]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playbookId: 'pb-1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe('completed');
  });

  it('POST /runs returns 404 for missing playbook', async () => {
    const db = createMockDb([[]]);
    const app = createTestApp(db);
    const res = await app.request('/api/remediation/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playbookId: 'missing' }),
    });
    expect(res.status).toBe(404);
  });
});
