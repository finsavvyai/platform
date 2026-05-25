/**
 * Sprint 35 line 50 (2 of 3) — integration tests for wlp-agents route.
 *
 * Uses the same direct-mount pattern as swg-tenants.test.ts: mocks the
 * auth/db/rbac middlewares and mounts wlpAgentRoutes on a fresh Hono
 * app. The route is currently NOT wired in register.ts (commented as
 * "WIP" — orchestrator packages exist; the comment is stale).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMockDb } from '../test/mock-db.js';

vi.mock('../middleware/db.js', () => ({
  dbMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('db', (globalThis as Record<string, unknown>).__mockDb);
    await next();
  },
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('userId', 'u1');
    c.set('email', 'u1@example.test');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('orgId', null);
    await next();
  },
}));

vi.mock('@opensyber/shared', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, generateId: () => 'tf-wlp-id-stub' };
});

import { wlpAgentRoutes } from './wlp-agents.js';

function buildApp(): Hono {
  const app = new Hono();
  app.route('/api/wlp', wlpAgentRoutes);
  return app;
}

describe('wlpAgentRoutes — Sprint 35 line 50 integration tests', () => {
  let db: ReturnType<typeof createMockDb>;
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    app = buildApp();
  });

  it('GET /api/wlp/agents returns the owner-scoped row list (200 with data array)', async () => {
    const rows = [
      { id: 'tf-wlp-1', hostname: 'web-01', agentType: 'falco', status: 'active' },
      { id: 'tf-wlp-2', hostname: 'db-01', agentType: 'osquery', status: 'stale' },
    ];
    db._setSelectResult(rows);
    const res = await app.request('/api/wlp/agents');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof rows };
    expect(body.data).toEqual(rows);
  });

  it('POST /api/wlp/agents returns 400 invalid_payload when hostname fails regex (e.g. spaces)', async () => {
    const res = await app.request('/api/wlp/agents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostname: 'host with spaces', agentType: 'falco', version: '1.0.0' }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('POST /api/wlp/agents returns 400 on agentType outside the allowed enum (zod reject)', async () => {
    const res = await app.request('/api/wlp/agents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostname: 'web-01', agentType: 'bogus', version: '1.0.0' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/wlp/agents returns 201 with stable id + status=active on valid payload', async () => {
    const res = await app.request('/api/wlp/agents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostname: 'web-01', agentType: 'falco', version: '1.0.0', tags: ['prod', 'web'] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; status: string; agentType: string } };
    expect(body.data.id).toBe('tf-wlp-id-stub');
    expect(body.data.status).toBe('active');
    expect(body.data.agentType).toBe('falco');
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('PATCH /api/wlp/agents/:id returns 404 when target row outside owner scope', async () => {
    db._setSelectResult([]);
    const res = await app.request('/api/wlp/agents/tf-wlp-missing', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'stale' }),
    });
    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/wlp/agents/:id stringifies tags array before write on owner-scope match', async () => {
    db._setSelectResult([{ id: 'tf-wlp-1' }]);
    await app.request('/api/wlp/agents/tf-wlp-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['prod', 'critical'] }),
    });
    const setArg = db._updateChain.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(setArg.tags).toBe(JSON.stringify(['prod', 'critical']));
  });

  it('DELETE /api/wlp/agents/:id returns 404 outside owner scope (no soft-delete fired)', async () => {
    db._setSelectResult([]);
    const res = await app.request('/api/wlp/agents/tf-wlp-missing', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('DELETE /api/wlp/agents/:id is SOFT-delete: status="offline" set on owned row, returns 200', async () => {
    db._setSelectResult([{ id: 'tf-wlp-1' }]);
    const res = await app.request('/api/wlp/agents/tf-wlp-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; status: string } };
    expect(body.data).toEqual({ id: 'tf-wlp-1', status: 'offline' });
    const setArg = db._updateChain.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(setArg.status).toBe('offline');
  });

  it('GET /api/wlp/findings short-circuits to [] when owner has zero agents', async () => {
    db._setSelectResult([]); // empty agent list → no findings to query
    const res = await app.request('/api/wlp/findings');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it('GET /api/wlp/findings returns 400 invalid_query on bad severity enum', async () => {
    const res = await app.request('/api/wlp/findings?severity=ULTRA');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_query');
  });

  it('GET /api/wlp/findings filters out cross-owner findings + applies severity filter', async () => {
    // First select: owner agents (ids: tf-wlp-1, tf-wlp-2)
    // Second select: ALL findings (3 rows). After in-app filter, only owned + matching severity should remain.
    db._setSelectResults([
      [{ id: 'tf-wlp-1' }, { id: 'tf-wlp-2' }],
      [
        { id: 'f1', agentId: 'tf-wlp-1', severity: 'critical' },
        { id: 'f2', agentId: 'tf-wlp-other', severity: 'critical' }, // cross-owner — filter out
        { id: 'f3', agentId: 'tf-wlp-2', severity: 'low' },          // own but wrong severity
      ],
    ]);
    const res = await app.request('/api/wlp/findings?severity=critical');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((r) => r.id)).toEqual(['f1']);
  });
});
