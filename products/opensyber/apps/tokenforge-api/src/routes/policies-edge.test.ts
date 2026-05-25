/**
 * Edge-case coverage for /v1/policies. Sibling of policies.test.ts
 * (176L, 9 cases) — pins the schema-default propagation, id format,
 * size boundaries, and partial-PATCH preservation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const validRules = JSON.stringify({ if_any: [{ geo_country_in: ['RU'] }], then: 'block' });

describe('POST /v1/policies — defaults + id format', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('priority defaults to 100 + enabled defaults to true when omitted', async () => {
    let captured: Record<string, unknown> | undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    await api('POST', '/v1/policies', env, { name: 'p', rules: validRules });
    expect(captured!.priority).toBe(100);
    expect(captured!.enabled).toBe(true);
  });

  it('returns id with `tf-pol-` prefix + UUID v4 form', async () => {
    const r = await api('POST', '/v1/policies', env, { name: 'p', rules: validRules });
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { id: string } };
    expect(j.data.id).toMatch(/^tf-pol-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects rules string longer than 8192 chars (zod max)', async () => {
    const tooBig = JSON.stringify({ then: 'allow', _padding: 'x'.repeat(9000) });
    const r = await api('POST', '/v1/policies', env, { name: 'p', rules: tooBig });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('rejects priority above 10000 (zod max)', async () => {
    const r = await api('POST', '/v1/policies', env, { name: 'p', rules: validRules, priority: 10001 });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('malformed JSON body → 400 invalid_payload (catch returns null → safeParse fails)', async () => {
    const r = await worker.fetch(
      new Request('http://localhost/v1/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
        body: '{not-json',
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });
});

describe('PATCH /v1/policies/:id — partial preservation', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('only `enabled` field in body → DB patch contains enabled + updatedAt only (no name/rules/priority)', async () => {
    db._setSelectResult([{ id: 'p1', tenantId: 't1', name: 'keep', priority: 100, enabled: true, rules: '{}' }]);
    await api('PATCH', '/v1/policies/p1', env, { enabled: false });
    const patchArg = db._updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(patchArg.enabled).toBe(false);
    expect(patchArg.updatedAt).toBeDefined();
    expect(patchArg.name).toBeUndefined();
    expect(patchArg.rules).toBeUndefined();
    expect(patchArg.priority).toBeUndefined();
  });
});
