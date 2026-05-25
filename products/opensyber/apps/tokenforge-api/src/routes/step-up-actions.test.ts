import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

async function api(method: string, path: string, env: Env, body?: unknown): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

let env: Env;
let db: ReturnType<typeof createMockDb>;
beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});

describe('GET /v1/step-up-actions', () => {
  it('404 tenant_not_found when DB has no tenant row', async () => {
    db._setSelectResult([]);
    const r = await api('GET', '/v1/step-up-actions', env);
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: string }).error).toBe('tenant_not_found');
  });

  it('returns actions=null when stepUpActions column is null', async () => {
    db._setSelectResult([{ stepUpActions: null }]);
    const r = await api('GET', '/v1/step-up-actions', env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { actions: unknown } };
    expect(j.data.actions).toBeNull();
  });

  it('returns the parsed policy array when valid JSON is stored', async () => {
    const policy = JSON.stringify([
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 30 },
    ]);
    db._setSelectResult([{ stepUpActions: policy }]);
    const r = await api('GET', '/v1/step-up-actions', env);
    const j = (await r.json()) as { data: { actions: Array<{ path: string }> } };
    expect(j.data.actions).toHaveLength(1);
    expect(j.data.actions[0]!.path).toBe('/checkout');
  });

  it('returns actions=null when stored JSON is malformed (no echo of invalid blob)', async () => {
    db._setSelectResult([{ stepUpActions: '{not-json' }]);
    const r = await api('GET', '/v1/step-up-actions', env);
    const j = (await r.json()) as { data: { actions: unknown } };
    expect(j.data.actions).toBeNull();
  });
});

describe('PUT /v1/step-up-actions', () => {
  it('400 invalid_payload when body is non-JSON', async () => {
    const r = await api('PUT', '/v1/step-up-actions', env, '{not-json');
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('400 invalid_payload when body is not an array or {actions:[...]}', async () => {
    const r = await api('PUT', '/v1/step-up-actions', env, { foo: 'bar' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('400 invalid_step_up_actions when array shape fails parser (e.g. >50 entries)', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ path: `/p${i}` }));
    const r = await api('PUT', '/v1/step-up-actions', env, tooMany);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_step_up_actions');
  });

  it('400 invalid_step_up_actions when freshSigMaxAgeSec is out of [5,600] range', async () => {
    const r = await api('PUT', '/v1/step-up-actions', env, [
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 4 },
    ]);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_step_up_actions');
  });

  it('200 with parsed actions + count when body is a valid JSON array', async () => {
    const r = await api('PUT', '/v1/step-up-actions', env, [
      { path: '/checkout', requireFreshSig: true, freshSigMaxAgeSec: 30 },
      { path: '/admin/*', requireWebAuthn: true },
    ]);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { count: number; actions: unknown[] } };
    expect(j.data.count).toBe(2);
    expect(db.update).toHaveBeenCalled();
  });

  it('accepts the {actions:[...]} envelope form for clients that prefer named keys', async () => {
    const r = await api('PUT', '/v1/step-up-actions', env, {
      actions: [{ path: '/checkout', requireFreshSig: true }],
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { count: number } };
    expect(j.data.count).toBe(1);
  });
});
