/**
 * Sprint 35 line 50 — integration tests for swg-tenants route.
 *
 * The route is currently NOT wired into apps/api/src/routes/register.ts
 * (commented "WIP: uncomment when orchestrator packages are built").
 * This test mounts swgTenantRoutes directly on a fresh Hono app with
 * the auth/db/rbac middleware mocked to no-ops — validates the route
 * handler logic without depending on the worker wiring.
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
  return { ...actual, generateId: () => 'tf-swg-id-stub' };
});

import { swgTenantRoutes } from './swg-tenants.js';

function buildApp(): Hono {
  const app = new Hono();
  app.route('/api/swg', swgTenantRoutes);
  return app;
}

describe('swgTenantRoutes — Sprint 35 line 50 integration tests', () => {
  let db: ReturnType<typeof createMockDb>;
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    app = buildApp();
  });

  it('GET /api/swg/tenants returns the owner-scoped row list (200 with data array)', async () => {
    const rows = [
      { id: 'tf-swg-1', tenantId: 'u1', name: 'acme', defaultAction: 'allow' },
      { id: 'tf-swg-2', tenantId: 'u1', name: 'globex', defaultAction: 'block' },
    ];
    db._setSelectResult(rows);
    const res = await app.request('/api/swg/tenants');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof rows };
    expect(body.data).toEqual(rows);
  });

  it('POST /api/swg/tenants returns 400 invalid_payload on missing name field', async () => {
    const res = await app.request('/api/swg/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_payload');
  });

  it('POST /api/swg/tenants returns 400 invalid_payload when upstreamProxy fails host:port regex', async () => {
    const res = await app.request('/api/swg/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'acme', upstreamProxy: 'not a valid proxy' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/swg/tenants returns 201 with stable id + echoed fields on valid payload', async () => {
    const payload = {
      name: 'acme', defaultAction: 'block' as const,
      categoriesBlocked: ['gambling', 'adult'],
      domainsAllowlist: ['ok.example'],
      tlsIntercept: true,
    };
    const res = await app.request('/api/swg/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; name: string; defaultAction: string } };
    expect(body.data.id).toBe('tf-swg-id-stub');
    expect(body.data.name).toBe('acme');
    expect(body.data.defaultAction).toBe('block');
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('PATCH /api/swg/tenants/:id returns 404 when target row is not in owner scope', async () => {
    db._setSelectResult([]); // no row matches id+tenantId
    const res = await app.request('/api/swg/tenants/tf-swg-missing', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    });
    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/swg/tenants/:id calls db.update on a matching row and returns 200', async () => {
    db._setSelectResult([{ id: 'tf-swg-1' }]); // owner-scope match
    const res = await app.request('/api/swg/tenants/tf-swg-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'renamed', tlsIntercept: false }),
    });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db._updateChain.set).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/swg/tenants/:id always returns { id, deleted: true } (idempotent ack)', async () => {
    const res = await app.request('/api/swg/tenants/tf-swg-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; deleted: boolean } };
    expect(body.data).toEqual({ id: 'tf-swg-1', deleted: true });
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('PATCH array fields (categoriesBlocked) are stringified when set', async () => {
    db._setSelectResult([{ id: 'tf-swg-1' }]);
    await app.request('/api/swg/tenants/tf-swg-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoriesBlocked: ['piracy'] }),
    });
    const setArg = db._updateChain.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(setArg.categoriesBlocked).toBe(JSON.stringify(['piracy']));
  });
});
