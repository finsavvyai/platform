/**
 * Sprint 35 line 50 (3 of 3) — integration tests for rbi/tenants route.
 *
 * Same direct-mount pattern as swg-tenants.test.ts and wlp-agents.test.ts.
 * The route is currently NOT wired in apps/api/src/routes/register.ts
 * (commented "WIP" — orchestrator packages exist; comment is stale).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMockDb } from '../../test/mock-db.js';

vi.mock('../../middleware/db.js', () => ({
  dbMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('db', (globalThis as Record<string, unknown>).__mockDb);
    await next();
  },
}));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('userId', 'u1');
    c.set('email', 'u1@example.test');
    await next();
  },
}));
vi.mock('../../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('orgId', null);
    await next();
  },
}));

vi.mock('@opensyber/shared', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, generateId: () => 'tf-rbi-id-stub' };
});

import { rbiTenantRoutes } from './tenants.js';

function buildApp(): Hono {
  const app = new Hono();
  app.route('/api/rbi', rbiTenantRoutes);
  return app;
}

const validBody = (over: Record<string, unknown> = {}) => ({
  tenantName: 'acme-rbi',
  kasmApiUrl: 'https://kasm.acme.example/api',
  kasmApiKeyId: 'k_abc123',
  apiKeySecretEncrypted: 'encrypted-secret-bytes',
  defaultImageId: 'img_chrome_v3',
  ...over,
});

describe('rbiTenantRoutes — Sprint 35 line 50 integration tests', () => {
  let db: ReturnType<typeof createMockDb>;
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    app = buildApp();
  });

  it('GET /api/rbi/tenants returns owner-scoped row list excluding status=deleted', async () => {
    const rows = [
      { id: 'tf-rbi-1', tenantName: 'acme', status: 'active' },
      { id: 'tf-rbi-2', tenantName: 'globex', status: 'provisioning' },
    ];
    db._setSelectResult(rows);
    const res = await app.request('/api/rbi/tenants');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: typeof rows }).data).toEqual(rows);
  });

  it('GET /api/rbi/tenants/:id returns 404 outside owner scope', async () => {
    db._setSelectResult([]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-missing');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });

  it('GET /api/rbi/tenants/:id returns 200 with single row when owner-scoped match', async () => {
    db._setSelectResult([{ id: 'tf-rbi-1', tenantName: 'acme', status: 'active' }]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe('tf-rbi-1');
  });

  it('POST /api/rbi/tenants returns 400 invalid_payload when tenantName missing', async () => {
    const { tenantName: _, ...partial } = validBody();
    void _;
    const res = await app.request('/api/rbi/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(partial),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('POST /api/rbi/tenants returns 400 when kasmApiUrl is not a valid URL (zod url() reject)', async () => {
    const res = await app.request('/api/rbi/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody({ kasmApiUrl: 'not a url' })),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/rbi/tenants returns 409 tenant_name_taken when active row exists with same name', async () => {
    // First select returns an existing row (the duplicate-check query).
    db._setSelectResult([{ id: 'tf-rbi-existing' }]);
    const res = await app.request('/api/rbi/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody()),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('tenant_name_taken');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('POST /api/rbi/tenants returns 201 with status=provisioning on first valid create', async () => {
    db._setSelectResult([]); // no existing row → duplicate check passes
    const res = await app.request('/api/rbi/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; status: string } };
    expect(body.data).toEqual({ id: 'tf-rbi-id-stub', status: 'provisioning' });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('PATCH /api/rbi/tenants/:id returns 404 outside owner scope', async () => {
    db._setSelectResult([]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-missing', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantName: 'renamed' }),
    });
    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/rbi/tenants/:id stamps updatedAt + applies fields on owner match', async () => {
    db._setSelectResult([{ id: 'tf-rbi-1' }]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    expect(res.status).toBe(200);
    const setArg = db._updateChain.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(setArg.status).toBe('paused');
    expect(setArg.updatedAt).toBeDefined();
  });

  it('DELETE /api/rbi/tenants/:id returns 404 outside owner scope (no soft-delete)', async () => {
    db._setSelectResult([]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-missing', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('DELETE /api/rbi/tenants/:id is SOFT-delete: status="deleted" set + updatedAt stamped', async () => {
    db._setSelectResult([{ id: 'tf-rbi-1' }]);
    const res = await app.request('/api/rbi/tenants/tf-rbi-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { status: string } }).data.status).toBe('deleted');
    const setArg = db._updateChain.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(setArg.status).toBe('deleted');
    expect(setArg.updatedAt).toBeDefined();
  });
});
