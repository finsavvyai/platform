/**
 * Edge-case coverage for /v1/proxy/config.
 * Sibling of proxy-config.test.ts (172L) — pins enterprise-plan parity,
 * scheme refinement, missing-CF-env path, delete-error resilience, and
 * stale-index handling on GET.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

const { tenantPlan } = vi.hoisted(() => ({ tenantPlan: { current: 'team' as string } }));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1'); c.set('tenantPlan', tenantPlan.current); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

const { mockRegister, mockDelete } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockDelete: vi.fn(),
}));
vi.mock('../services/custom-hostname.js', () => ({
  registerCustomHostname: mockRegister,
  deleteCustomHostname: mockDelete,
  getDnsInstructions: vi.fn((h: string) => ({ cname: `${h}.cdn.cloudflare.net`, providers: ['cf'] })),
}));

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

describe('POST /v1/proxy/config — edge cases', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
    mockRegister.mockResolvedValue({ success: true, status: 'pending_validation', verificationTxt: 'tf-v=abc' });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('enterprise plan is also accepted (parity with team)', async () => {
    tenantPlan.current = 'enterprise';
    const r = await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'https://x.test' });
    expect(r.status).toBe(200);
  });

  it('pro plan is rejected with plan_required (only team + enterprise)', async () => {
    tenantPlan.current = 'pro';
    const r = await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'https://x.test' });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: string }).error).toBe('plan_required');
  });

  it('origin with non-http(s) scheme (ftp://) → 400 validation_error', async () => {
    const r = await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'ftp://x.test/file' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('validation_error');
  });

  it('without CF_API_TOKEN → status=pending_dns + ssl=pending + verificationTxt=null', async () => {
    env = createMockEnv({ CF_API_TOKEN: undefined as unknown as string, CF_ZONE_ID: undefined as unknown as string });
    const r = await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'https://x.test' });
    const j = (await r.json()) as { data: { status: string; ssl: string; verificationTxt: string | null } };
    expect(j.data.status).toBe('pending_dns');
    expect(j.data.ssl).toBe('pending');
    expect(j.data.verificationTxt).toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('stored config in KV includes tenantId + verifyPaths default ["/api/*"]', async () => {
    await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'https://x.test' });
    const stored = JSON.parse((await env.CACHE.get('proxy:a.example.com'))!) as Record<string, unknown>;
    expect(stored.tenantId).toBe('t1');
    expect(stored.verifyPaths).toEqual(['/api/*']);
    expect(stored.skipPaths).toEqual([]);
    expect(stored.blockOnFail).toBe(true);
  });
});

describe('DELETE /v1/proxy/config/:hostname — error resilience', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('still returns 200 + cleans KV when deleteCustomHostname rejects', async () => {
    mockDelete.mockRejectedValueOnce(new Error('cf-api-down'));
    await env.CACHE.put('proxy:gone.example.com', JSON.stringify({ origin: 'x', tenantId: 't1' }));
    await env.CACHE.put('proxy_index:t1', JSON.stringify(['gone.example.com']));
    const r = await api('DELETE', '/v1/proxy/config/gone.example.com', env);
    expect(r.status).toBe(200);
    expect(await env.CACHE.get('proxy:gone.example.com')).toBeNull();
  });
});

describe('GET /v1/proxy/config — stale index handling', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
  });

  it('skips hostnames in the index whose per-hostname KV record is missing', async () => {
    await env.CACHE.put('proxy_index:t1', JSON.stringify(['live.example.com', 'orphan.example.com']));
    await env.CACHE.put('proxy:live.example.com', JSON.stringify({ origin: 'https://live', tenantId: 't1' }));
    // No proxy:orphan.example.com — stale index entry
    const r = await api('GET', '/v1/proxy/config', env);
    const data = ((await r.json()) as { data: Array<{ hostname: string }> }).data;
    expect(data.map((c) => c.hostname)).toEqual(['live.example.com']);
  });
});
