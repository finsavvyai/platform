import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function getSessions(env: Env, qs = ''): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/dbsc/sessions${qs}`, {
      headers: { authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

async function postRevoke(id: string, body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/dbsc/sessions/${id}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const okSession = (over: Record<string, unknown> = {}) => ({
  id: 'tf-dbsc-1',
  tenantId: 't1',
  deviceId: 'dev_1',
  revoked: 0,
  revokedReason: null,
  ...over,
});

describe('GET /v1/dbsc/sessions', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns the rows array under data', async () => {
    db._setSelectResult([okSession(), okSession({ id: 'tf-dbsc-2' })]);
    const r = await getSessions(env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Array<{ id: string }> };
    expect(j.data).toHaveLength(2);
    expect(j.data[0]!.id).toBe('tf-dbsc-1');
  });

  it('clamps limit query to [1, 100] inclusive AND defaults to 20 when omitted', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn(() => chain); chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => chain);
      chain.limit = vi.fn((n: number) => { captured = n; return Promise.resolve([]); });
      return chain;
    });
    await getSessions(env, '?limit=999'); expect(captured).toBe(100);
    await getSessions(env, '?limit=0'); expect(captured).toBe(1);
    await getSessions(env); expect(captured).toBe(20);
  });
});

describe('POST /v1/dbsc/sessions/:id/revoke', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 404 session_not_found when row missing', async () => {
    db._setSelectResult([]);
    const r = await postRevoke('tf-dbsc-missing', { reason: 'compromised' }, env);
    expect(r.status).toBe(404);
    expect((await r.json() as { error: string }).error).toBe('session_not_found');
  });

  it('soft-revokes with provided reason', async () => {
    db._setSelectResult([okSession()]);
    const r = await postRevoke('tf-dbsc-1', { reason: 'compromised_device' }, env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { revoked: boolean; id: string; reason: string } };
    expect(j.data).toEqual({ revoked: true, id: 'tf-dbsc-1', reason: 'compromised_device' });
    expect(db.update).toHaveBeenCalled();
  });

  it('uses default reason "admin_revoked" when body is empty', async () => {
    db._setSelectResult([okSession()]);
    const r = await postRevoke('tf-dbsc-1', {}, env);
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('admin_revoked');
  });

  it('returns alreadyRevoked when session was previously revoked', async () => {
    db._setSelectResult([okSession({ revoked: 1, revokedReason: 'compromised' })]);
    const r = await postRevoke('tf-dbsc-1', { reason: 'second_call' }, env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { revoked: boolean; alreadyRevoked: boolean } };
    expect(j.data.revoked).toBe(true);
    expect(j.data.alreadyRevoked).toBe(true);
    // No further DB write
    expect(db.update).not.toHaveBeenCalled();
  });

  it('falls back to default reason when body parses but reason absent', async () => {
    db._setSelectResult([okSession()]);
    const r = await postRevoke('tf-dbsc-1', { unrelated: 'field' }, env);
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('admin_revoked');
  });

  it('reason >120 chars → schema rejects → falls back to admin_revoked (does NOT 400)', async () => {
    db._setSelectResult([okSession()]);
    const longReason = 'x'.repeat(121);
    const r = await postRevoke('tf-dbsc-1', { reason: longReason }, env);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { reason: string } }).data.reason).toBe('admin_revoked');
  });

  it('reason at exactly 120 chars passes the schema (boundary inclusive)', async () => {
    db._setSelectResult([okSession()]);
    const reason = 'x'.repeat(120);
    const r = await postRevoke('tf-dbsc-1', { reason }, env);
    expect(((await r.json()) as { data: { reason: string } }).data.reason).toBe(reason);
  });

  it('malformed JSON body → caught + falls back to admin_revoked (does NOT 500)', async () => {
    db._setSelectResult([okSession()]);
    const r = await worker.fetch(
      new Request('http://localhost/v1/dbsc/sessions/tf-dbsc-1/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
        body: '{not-json',
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { reason: string } }).data.reason).toBe('admin_revoked');
  });
});

