import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  rateLimit,
  publicRateLimit,
  apiRateLimit,
  authRateLimit,
} from './rate-limit.js';
import type { Env, Variables } from '../types.js';

interface FakeKV {
  store: Map<string, string>;
  get: (k: string) => Promise<string | null>;
  put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void>;
  _puts: Array<{ k: string; v: string; ttl?: number }>;
}

function makeKV(): FakeKV {
  const store = new Map<string, string>();
  const puts: Array<{ k: string; v: string; ttl?: number }> = [];
  return {
    store, _puts: puts,
    get: async (k) => store.get(k) ?? null,
    put: async (k, v, opts) => { store.set(k, v); puts.push({ k, v, ttl: opts?.expirationTtl }); },
  };
}

function appWith(mw: ReturnType<typeof rateLimit>, tenantId?: string) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => {
    if (tenantId !== undefined) c.set('tenantId', tenantId);
    await next();
  });
  app.use('*', mw);
  app.get('/x', (c) => c.text('ok'));
  return app;
}

const ctx = { waitUntil: vi.fn(async (p) => { await p; }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

async function fetchWith(
  app: ReturnType<typeof appWith>,
  init: RequestInit,
  envObj: Env,
): Promise<Response> {
  return app.fetch(new Request('http://localhost/x', init), envObj, ctx);
}

let kv: FakeKV;
const env = (over: Partial<Env> = {}) =>
  ({ CACHE: kv as unknown as KVNamespace, ...over }) as unknown as Env;

beforeEach(() => { kv = makeKV(); });

describe('rateLimit (IP source)', () => {
  const mw = rateLimit({ limit: 3, window: 60, prefix: 'test', keySource: 'ip' });

  it('allows requests under the limit and sets RateLimit-* headers', async () => {
    const app = appWith(mw);
    const res = await fetchWith(app, {
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    }, env());
    expect(res.status).toBe(200);
    expect(res.headers.get('RateLimit-Limit')).toBe('3');
    expect(res.headers.get('RateLimit-Remaining')).toBe('2');
  });

  it('returns 429 with rate_limit_exceeded when bucket is at limit', async () => {
    const bucket = Math.floor(Date.now() / 60_000);
    kv.store.set(`rl:test:1.2.3.4:${bucket}`, '3');
    const app = appWith(mw);
    const res = await fetchWith(app, { headers: { 'cf-connecting-ip': '1.2.3.4' } }, env());
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('rate_limit_exceeded');
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('writes the increment with TTL = window*2 so cleanup works under burst', async () => {
    const app = appWith(mw);
    await fetchWith(app, { headers: { 'cf-connecting-ip': '1.2.3.4' } }, env());
    expect(kv._puts).toHaveLength(1);
    expect(kv._puts[0]!.ttl).toBe(120);
  });

  it('falls back to "unknown" when no IP header is present', async () => {
    const app = appWith(mw);
    await fetchWith(app, {}, env());
    expect(kv._puts[0]!.k).toContain(':unknown:');
  });

  it('prefers cf-connecting-ip over x-forwarded-for when both are set', async () => {
    const app = appWith(mw);
    await fetchWith(app, {
      headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
    }, env());
    expect(kv._puts[0]!.k).toContain(':1.1.1.1:');
  });
});

describe('rateLimit (tenant + tenant-or-ip)', () => {
  it('keySource=tenant uses c.get("tenantId") for the bucket key', async () => {
    const mw = rateLimit({ limit: 5, window: 60, prefix: 'tnt', keySource: 'tenant' });
    const app = appWith(mw, 't_abc');
    await fetchWith(app, { headers: { 'cf-connecting-ip': '1.2.3.4' } }, env());
    expect(kv._puts[0]!.k).toContain(':t_abc:');
  });

  it('keySource=tenant-or-ip falls back to IP when no tenantId is set', async () => {
    const mw = rateLimit({ limit: 5, window: 60, prefix: 'mix', keySource: 'tenant-or-ip' });
    const app = appWith(mw); // no tenantId
    await fetchWith(app, { headers: { 'cf-connecting-ip': '9.9.9.9' } }, env());
    expect(kv._puts[0]!.k).toContain(':9.9.9.9:');
  });

  it('keySource=tenant-or-ip uses tenantId when present', async () => {
    const mw = rateLimit({ limit: 5, window: 60, prefix: 'mix', keySource: 'tenant-or-ip' });
    const app = appWith(mw, 't_xyz');
    await fetchWith(app, { headers: { 'cf-connecting-ip': '9.9.9.9' } }, env());
    expect(kv._puts[0]!.k).toContain(':t_xyz:');
  });
});

describe('rateLimit window math', () => {
  it('Reset header equals (bucket+1) * window', async () => {
    const mw = rateLimit({ limit: 1, window: 60, prefix: 'w', keySource: 'ip' });
    const app = appWith(mw);
    const res = await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    const expected = (Math.floor(Date.now() / 60_000) + 1) * 60;
    expect(res.headers.get('RateLimit-Reset')).toBe(String(expected));
  });

  it('exhausting the bucket forces 429 on the next request (sliding-window boundary)', async () => {
    const mw = rateLimit({ limit: 2, window: 60, prefix: 'seq', keySource: 'ip' });
    const app = appWith(mw);
    const r1 = await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    const r2 = await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    const r3 = await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});

describe('preset limiters', () => {
  it('publicRateLimit is 60/min IP-keyed', async () => {
    const app = appWith(publicRateLimit);
    await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    expect(kv._puts[0]!.k.startsWith('rl:pub:1.1.1.1:')).toBe(true);
    expect(kv._puts[0]!.ttl).toBe(120);
  });

  it('authRateLimit is 10/min IP-keyed (brute-force protection prefix `auth`)', async () => {
    const app = appWith(authRateLimit);
    await fetchWith(app, { headers: { 'cf-connecting-ip': '1.1.1.1' } }, env());
    expect(kv._puts[0]!.k.startsWith('rl:auth:1.1.1.1:')).toBe(true);
  });

  it('apiRateLimit is 600/min tenant-or-ip keyed', async () => {
    const app = appWith(apiRateLimit, 't_acme');
    await fetchWith(app, {}, env());
    expect(kv._puts[0]!.k.startsWith('rl:api:t_acme:')).toBe(true);
  });
});
