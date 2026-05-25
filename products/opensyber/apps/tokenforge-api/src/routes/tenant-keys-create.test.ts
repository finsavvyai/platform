import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { tenantPlan } = vi.hoisted(() => ({ tenantPlan: { current: 'pro' as string } }));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', tenantPlan.current);
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

const { mockLogAudit } = vi.hoisted(() => ({ mockLogAudit: vi.fn(async () => undefined) }));
vi.mock('../services/audit-log.js', () => ({ logAudit: mockLogAudit }));

import worker from '../index.js';

async function postKey(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/tenant/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /v1/tenant/api-keys', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    tenantPlan.current = 'pro';
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 validation_error when name is missing', async () => {
    const res = await postKey({}, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('validation_error');
  });

  it('returns 400 when name is over 64 characters', async () => {
    const res = await postKey({ name: 'x'.repeat(65) }, env);
    expect(res.status).toBe(400);
  });

  it('returns 403 plan_limit when free tenant already has the maximum active keys', async () => {
    tenantPlan.current = 'free';
    // Free plan caps at 2 active keys (per PLAN_KEY_LIMITS in types.ts) — seed 2
    db._setSelectResult([{ id: 'k1' }, { id: 'k2' }]);
    const res = await postKey({ name: 'third-key' }, env);
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toBe('plan_limit');
  });

  it('returns 403 plan_limit when domain count exceeds the per-key cap on free tier', async () => {
    tenantPlan.current = 'free';
    db._setSelectResult([]); // no existing keys
    const res = await postKey({
      name: 'k1',
      allowedDomains: Array.from({ length: 50 }, (_, i) => `${i}.example.com`),
    }, env);
    expect(res.status).toBe(403);
  });

  it('returns 201 with id+name+key+prefix+createdAt on happy path (no expiry, no domains)', async () => {
    db._setSelectResult([]);
    const res = await postKey({ name: 'production' }, env);
    expect(res.status).toBe(201);
    const j = (await res.json()) as { data: { id: string; name: string; key: string; prefix: string; expiresAt: string | null; allowedDomains: string[]; createdAt: string } };
    expect(j.data.id).toBeTruthy();
    expect(j.data.name).toBe('production');
    expect(j.data.key).toMatch(/^tf_[a-f0-9]{32}$/);
    expect(j.data.prefix).toMatch(/^tf_[a-f0-9]{5}\.\.\.$/);
    expect(j.data.expiresAt).toBeNull();
    expect(j.data.allowedDomains).toEqual([]);
    expect(j.data.createdAt).toBeTruthy();
    // Audit logged via waitUntil
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it('sets expiresAt approximately +N days when expiresInDays is provided', async () => {
    db._setSelectResult([]);
    const res = await postKey({ name: 'short-lived', expiresInDays: 7 }, env);
    const j = (await res.json()) as { data: { expiresAt: string } };
    const exp = new Date(j.data.expiresAt).getTime();
    const expectedFloor = Date.now() + 6 * 24 * 60 * 60_000;
    const expectedCeil = Date.now() + 8 * 24 * 60 * 60_000;
    expect(exp).toBeGreaterThan(expectedFloor);
    expect(exp).toBeLessThan(expectedCeil);
  });

  it('persists allowedDomains into KV under key `domains:<keyId>` when provided', async () => {
    db._setSelectResult([]);
    const res = await postKey({
      name: 'with-domains',
      allowedDomains: ['app.example.com', 'admin.example.com'],
    }, env);
    const j = (await res.json()) as { data: { id: string; allowedDomains: string[] } };
    const stored = await env.CACHE.get(`domains:${j.data.id}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(['app.example.com', 'admin.example.com']);
    expect(j.data.allowedDomains).toEqual(['app.example.com', 'admin.example.com']);
  });

  it('rejects expiresInDays=0 (zod .positive() requires strictly > 0)', async () => {
    const res = await postKey({ name: 'k', expiresInDays: 0 }, env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation_error');
  });

  it('rejects expiresInDays=-1 with 400 invalid_payload', async () => {
    const res = await postKey({ name: 'k', expiresInDays: -1 }, env);
    expect(res.status).toBe(400);
  });

  it('rejects fractional expiresInDays (1.5) — zod .int() guard', async () => {
    const res = await postKey({ name: 'k', expiresInDays: 1.5 }, env);
    expect(res.status).toBe(400);
  });

  it('rejects allowedDomains array longer than 100 entries (zod .max(100))', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `${i}.example.com`);
    const res = await postKey({ name: 'k', allowedDomains: tooMany }, env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation_error');
  });

  it('audit log payload includes keyId + keyName + allowedDomains array', async () => {
    db._setSelectResult([]);
    await postKey({ name: 'audited', allowedDomains: ['a.example.com'] }, env);
    expect(mockLogAudit).toHaveBeenCalled();
    const call = mockLogAudit.mock.calls.find((c) => c[1] === 'api_key.created');
    expect(call).toBeDefined();
    const payload = call![3] as Record<string, unknown>;
    expect(payload.keyId).toBeTruthy();
    expect(payload.keyName).toBe('audited');
    expect(payload.allowedDomains).toEqual(['a.example.com']);
  });

  it('DB.insert row has isActive=true + keyHash !== rawKey (one-way storage)', async () => {
    db._setSelectResult([]);
    const res = await postKey({ name: 'safe' }, env);
    const j = (await res.json()) as { data: { key: string } };
    const inserted = db._insertChain.values.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.isActive).toBe(true);
    expect(typeof inserted.keyHash).toBe('string');
    expect(inserted.keyHash).not.toBe(j.data.key); // hash, not raw
    expect((inserted.keyHash as string).length).toBeGreaterThan(20);
  });
});
