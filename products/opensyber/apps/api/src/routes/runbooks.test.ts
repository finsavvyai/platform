import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock middleware so the route runs without real DB / real auth.
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const a = c.req.header('Authorization');
    if (!a?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  resolveOrgContextAutoDetect: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => { await next(); },
}));
vi.mock('../middleware/db.js', () => ({
  dbMiddleware: async (c: any, next: any) => {
    c.set('db', (globalThis as any).__mockDb);
    await next();
  },
}));

// Stub the executor — route tests verify wiring, not engine semantics.
vi.mock('../services/runbooks/executor.js', () => ({
  executeRunbook: vi.fn(async () => ({
    runId: 'fake-run-id',
    status: 'completed',
    stepsExecuted: 3,
  })),
}));

import { runbookRoutes } from './runbooks.js';

function makeMockDb() {
  const queue: any[] = [];
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: any) => Promise.resolve(resolve(queue.shift() ?? [])),
  };
  return {
    select: () => chain,
    _push: (rows: any[]) => queue.push(rows),
  };
}

describe('runbook routes', () => {
  let app: Hono;
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockDb = makeMockDb();
    (globalThis as any).__mockDb = mockDb;
    app = new Hono();
    app.route('/api/runbooks', runbookRoutes);
  });

  const auth = { Authorization: 'Bearer t' };

  it('GET /api/runbooks returns built-in registry', async () => {
    const res = await app.request('/api/runbooks', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((r: any) => r.id);
    expect(ids).toContain('phishing-triage');
    expect(body.data[0]).toHaveProperty('step_count');
  });

  it('GET /api/runbooks rejects without auth', async () => {
    const res = await app.request('/api/runbooks');
    expect(res.status).toBe(401);
  });

  it('POST /api/runbooks/runs rejects unknown runbook_id', async () => {
    const res = await app.request('/api/runbooks/runs', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ runbook_id: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBe('not_found');
  });

  it('POST /api/runbooks/runs rejects bad payload', async () => {
    const res = await app.request('/api/runbooks/runs', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ wrong: 'field' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/runbooks/runs with a valid runbook returns run state', async () => {
    const res = await app.request('/api/runbooks/runs', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ runbook_id: 'phishing-triage' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.runId).toBe('fake-run-id');
    expect(body.data.status).toBe('completed');
  });

  it('GET /api/runbooks/runs returns the list', async () => {
    mockDb._push([{ id: 'r1', runbookId: 'phishing-triage', status: 'completed' }]);
    const res = await app.request('/api/runbooks/runs', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
  });

  it('GET /api/runbooks/runs/:id returns 404 when missing', async () => {
    mockDb._push([]); // no run found
    const res = await app.request('/api/runbooks/runs/missing', { headers: auth });
    expect(res.status).toBe(404);
  });

  it('GET /api/runbooks/runs/:id returns run + steps when found', async () => {
    mockDb._push([{ id: 'r1', runbookId: 'phishing-triage', status: 'completed' }]);
    mockDb._push([
      { id: 's1', runId: 'r1', stepIndex: 0, action: 'call_skill', status: 'success' },
      { id: 's2', runId: 'r1', stepIndex: 1, action: 'http_request', status: 'success' },
    ]);
    const res = await app.request('/api/runbooks/runs/r1', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.run.id).toBe('r1');
    expect(body.data.steps).toHaveLength(2);
  });
});
