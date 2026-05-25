/**
 * Edge-case coverage for /v1/workforce/apps. Sibling of
 * workforce-apps.test.ts (181L) — pins schema-default propagation,
 * id format, jwksUri validation, partial PATCH preservation, and
 * malformed JSON resilience.
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

const validBody = (over: Record<string, unknown> = {}) => ({
  name: 'corp', idpType: 'oidc_okta', issuer: 'https://acme.okta.com/oauth2/default',
  audience: 'tf-app-1', jwksUri: 'https://acme.okta.com/oauth2/default/v1/keys', ...over,
});

describe('POST /v1/workforce/apps — schema defaults + id', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('defaults: enabled=true, tokenEndpoint=null, allowedOrigins="" when omitted', async () => {
    let captured: Record<string, unknown> | undefined;
    db.insert = vi.fn(() => ({ values: vi.fn(async (v: Record<string, unknown>) => { captured = v; }) }));
    await api('POST', '/v1/workforce/apps', env, validBody());
    expect(captured!.enabled).toBe(true);
    expect(captured!.tokenEndpoint).toBeNull();
    expect(captured!.allowedOrigins).toBe('');
  });

  it('returns id with `tf-wf-` prefix + UUID v4 form', async () => {
    const r = await api('POST', '/v1/workforce/apps', env, validBody());
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { id: string } };
    expect(j.data.id).toMatch(/^tf-wf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects malformed jwksUri with 400 invalid_payload (parity with issuer)', async () => {
    const r = await api('POST', '/v1/workforce/apps', env, validBody({ jwksUri: 'not-a-url' }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('malformed JSON body → 400 invalid_payload (catch returns null → safeParse fails)', async () => {
    const r = await worker.fetch(
      new Request('http://localhost/v1/workforce/apps', {
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

describe('PATCH /v1/workforce/apps/:id — partial preservation', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('only `enabled` in body → DB patch contains enabled+updatedAt only (no name/issuer/etc)', async () => {
    db._setSelectResult([{ id: 'wf-1', tenantId: 't1', name: 'keep', idpType: 'oidc_okta' }]);
    await api('PATCH', '/v1/workforce/apps/wf-1', env, { enabled: false });
    const patch = db._updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch.enabled).toBe(false);
    expect(patch.updatedAt).toBeDefined();
    expect(patch.name).toBeUndefined();
    expect(patch.idpType).toBeUndefined();
    expect(patch.issuer).toBeUndefined();
    expect(patch.audience).toBeUndefined();
    expect(patch.jwksUri).toBeUndefined();
  });
});
