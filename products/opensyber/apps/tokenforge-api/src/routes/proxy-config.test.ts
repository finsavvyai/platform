import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { tenantPlan } = vi.hoisted(() => ({ tenantPlan: { current: 'team' as string } }));
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

vi.mock('../services/custom-hostname.js', () => ({
  registerCustomHostname: vi.fn(async () => ({ success: true, status: 'pending_validation', verificationTxt: 'tf-v=abc' })),
  deleteCustomHostname: vi.fn(async () => undefined),
  getDnsInstructions: vi.fn((hostname: string) => ({
    cname: `${hostname}.cdn.cloudflare.net`,
    providers: ['cloudflare', 'route53'],
  })),
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

describe('POST /v1/proxy/config', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 403 plan_required when tenantPlan is free', async () => {
    tenantPlan.current = 'free';
    const res = await api('POST', '/v1/proxy/config', env, { hostname: 'a.example.com', origin: 'https://x.test' });
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toBe('plan_required');
  });

  it('returns 400 validation_error when hostname missing', async () => {
    const res = await api('POST', '/v1/proxy/config', env, { origin: 'https://x.test' });
    expect(res.status).toBe(400);
  });

  it('returns 429 limit_exceeded when tenant already has 10 distinct hostnames', async () => {
    const existing = Array.from({ length: 10 }, (_, i) => `h${i}.example.com`);
    await env.CACHE.put('proxy_index:t1', JSON.stringify(existing));
    const res = await api('POST', '/v1/proxy/config', env, { hostname: 'new.example.com', origin: 'https://x.test' });
    expect(res.status).toBe(429);
    expect((await res.json() as { error: string }).error).toBe('limit_exceeded');
  });

  it('updating an EXISTING hostname does not count toward the 10-domain cap', async () => {
    const existing = Array.from({ length: 10 }, (_, i) => `h${i}.example.com`);
    await env.CACHE.put('proxy_index:t1', JSON.stringify(existing));
    // Same hostname already in index — update path, not insert
    const res = await api('POST', '/v1/proxy/config', env, { hostname: 'h0.example.com', origin: 'https://updated.test' });
    expect(res.status).toBe(200);
  });

  it('on happy path: persists config in KV, adds to index, returns hostname+origin+status+dns', async () => {
    const res = await api('POST', '/v1/proxy/config', env, {
      hostname: 'app.example.com',
      origin: 'https://origin.example.com',
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { hostname: string; origin: string; status: string; dns: { cname: string } } };
    expect(j.data.hostname).toBe('app.example.com');
    expect(j.data.origin).toBe('https://origin.example.com');
    expect(j.data.status).toBe('registered');
    expect(j.data.dns.cname).toContain('cloudflare.net');
    // KV state was updated
    const stored = await env.CACHE.get('proxy:app.example.com');
    expect(stored).not.toBeNull();
    const idx = JSON.parse((await env.CACHE.get('proxy_index:t1')) ?? '[]') as string[];
    expect(idx).toContain('app.example.com');
  });
});

describe('GET /v1/proxy/config', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
  });

  it('returns empty data array when no proxies configured', async () => {
    const res = await api('GET', '/v1/proxy/config', env);
    const j = (await res.json()) as { data: unknown[] };
    expect(j.data).toEqual([]);
  });

  it('returns the list of configs joined from KV index + per-hostname records', async () => {
    await env.CACHE.put('proxy_index:t1', JSON.stringify(['a.example.com', 'b.example.com']));
    await env.CACHE.put('proxy:a.example.com', JSON.stringify({ origin: 'https://a-origin', tenantId: 't1' }));
    await env.CACHE.put('proxy:b.example.com', JSON.stringify({ origin: 'https://b-origin', tenantId: 't1' }));
    const res = await api('GET', '/v1/proxy/config', env);
    const j = (await res.json()) as { data: Array<{ hostname: string; origin: string; status: string }> };
    expect(j.data).toHaveLength(2);
    expect(j.data.map((c) => c.hostname).sort()).toEqual(['a.example.com', 'b.example.com']);
    expect(j.data[0]!.status).toBe('active');
  });
});

describe('DELETE /v1/proxy/config/:hostname', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
    tenantPlan.current = 'team';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 404 when no config exists for the hostname', async () => {
    const res = await api('DELETE', '/v1/proxy/config/missing.example.com', env);
    expect(res.status).toBe(404);
  });

  it('returns 403 forbidden when config belongs to a different tenant', async () => {
    await env.CACHE.put('proxy:other.example.com', JSON.stringify({ origin: 'x', tenantId: 't-other' }));
    const res = await api('DELETE', '/v1/proxy/config/other.example.com', env);
    expect(res.status).toBe(403);
  });

  it('removes the config from KV + tenant index on happy path', async () => {
    await env.CACHE.put('proxy:gone.example.com', JSON.stringify({ origin: 'x', tenantId: 't1' }));
    await env.CACHE.put('proxy_index:t1', JSON.stringify(['gone.example.com', 'keep.example.com']));
    const res = await api('DELETE', '/v1/proxy/config/gone.example.com', env);
    expect(res.status).toBe(200);
    expect(await env.CACHE.get('proxy:gone.example.com')).toBeNull();
    const idx = JSON.parse((await env.CACHE.get('proxy_index:t1')) ?? '[]') as string[];
    expect(idx).toEqual(['keep.example.com']);
  });
});
