import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
const { mockDispatchWebhook } = vi.hoisted(() => ({ mockDispatchWebhook: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/webhook-dispatch.js', () => ({
  dispatchWebhook: mockDispatchWebhook,
  crossedCritical: () => false,
  crossedDegraded: () => false,
}));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

async function workerRequest(
  path: string,
  init: RequestInit = {},
  env: Env,
): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return worker.fetch(
    req,
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

function authHeaders(): Record<string, string> {
  return { Authorization: 'Bearer tf_testkey123' };
}

describe('Usage Limit Middleware', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('allows request when under limit', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 100, totalBinds: 50 }],
      [],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Usage-Remaining')).toBe('850');
  });

  it('returns 429 when over hard cap (110%)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 1100, totalBinds: 100 }],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('rate_limit_exceeded');
  });

  it('allows enterprise plan with unlimited usage', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'enterprise' }],
      [],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Usage-Remaining')).toBe('unlimited');
  });

  it('allows request at exactly the limit (under 110% cap)', async () => {
    // free plan = 1000, so at 1000 usage, hard cap = 1100, still under
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 900, totalBinds: 100 }],
      [],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Usage-Remaining')).toBe('0');
  });

  it('fires usage.cap_exceeded webhook when 429 is returned (security telemetry escapes billing gate)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 1200, totalBinds: 0 }],
    ]);
    await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    const cap = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'usage.cap_exceeded');
    expect(cap).toBeDefined();
    const payload = cap![3] as { plan: string; limit: number; hardCap: number; totalUsage: number };
    expect(payload.plan).toBe('free');
    expect(payload.limit).toBe(1000);
    expect(payload.hardCap).toBe(1100); // ceil(1000 * 1.1)
    expect(payload.totalUsage).toBe(1200);
  });

  it('hardCap = ceil(limit * 1.1): pro=50000 → cap=55000 (request just over fails 429)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 55000, totalBinds: 1 }],
    ]);
    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(429);
  });

  it('X-Usage-Remaining clamps to 0 when total exceeds limit but stays under hardCap', async () => {
    // free=1000, hardCap=1100. usage=1050 → over limit, under cap → allow, remaining=0
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 1050, totalBinds: 0 }],
      [],
    ]);
    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Usage-Remaining')).toBe('0');
  });

  it('unknown plan falls back to free-plan limit (?? PLAN_LIMITS.free fallback)', async () => {
    // 'mystery-plan' is not in PLAN_LIMITS — the `?? PLAN_LIMITS['free']!`
    // chain at line 20 of source kicks in. Same usage as the free-tier
    // boundary case to confirm the limit applied is 1000 (not Infinity,
    // not undefined, not crashing).
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'mystery-plan' }],
      [{ totalVerifications: 1200, totalBinds: 0 }], // > free hardCap=1100
    ]);
    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe('rate_limit_exceeded');
  });

  it('hardCap boundary inclusive: usage === hardCap returns 429 (not 200)', async () => {
    // free=1000, hardCap=1100. usage=1100 EXACTLY — `>=` strict in source
    // line 55 means this triggers the 429 path, not the allow path.
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 1100, totalBinds: 0 }],
    ]);
    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(429);
  });

  it('usage.cap_exceeded webhook payload includes request path + method (security forensics)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 1500, totalBinds: 0 }],
    ]);
    await workerRequest('/v1/verify', { method: 'POST', headers: { ...authHeaders(), 'content-type': 'application/json' }, body: '{}' }, mockEnv);
    const cap = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'usage.cap_exceeded');
    expect(cap).toBeDefined();
    const payload = cap![3] as { path: string; method: string };
    expect(payload.path).toBe('/v1/verify');
    expect(payload.method).toBe('POST');
  });
});
