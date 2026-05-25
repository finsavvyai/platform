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

describe('POST /v1/alerts/rules', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 validation_error when condition is unknown', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'unknown_event', channel: 'email', destination: 'a@b.com',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('validation_error');
  });

  it('rejects webhook destination using HTTP (must be HTTPS)', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'http://example.com/hook',
    });
    expect(res.status).toBe(400);
  });

  it('SSRF guard: rejects webhook destination on 127.0.0.1', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'https://127.0.0.1/hook',
    });
    expect(res.status).toBe(400);
  });

  it('SSRF guard: rejects 192.168.x.x private network', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'https://192.168.1.5/hook',
    });
    expect(res.status).toBe(400);
  });

  it('SSRF guard: rejects 10.x and 172.16-31.x private ranges', async () => {
    const r10 = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'https://10.0.0.1/hook',
    });
    expect(r10.status).toBe(400);
    const r172 = await api('POST', '/v1/alerts/rules', env, {
      name: 'r2', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'https://172.20.0.1/hook',
    });
    expect(r172.status).toBe(400);
  });

  it('SSRF guard: rejects literal "localhost"', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r1', condition: 'hijack_attempt', channel: 'webhook',
      destination: 'https://localhost/hook',
    });
    expect(res.status).toBe(400);
  });

  it('accepts email destination (no URL validation)', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'sec-team', condition: 'hijack_attempt', channel: 'email',
      destination: 'sec@acme.com',
    });
    expect(res.status).toBe(201);
    const j = (await res.json()) as { data: { id: string; name: string } };
    expect(j.data.id).toBeTruthy();
    expect(j.data.name).toBe('sec-team');
  });

  it('accepts public HTTPS webhook URL and persists in KV', async () => {
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'siem', condition: 'trust_drop', threshold: 60,
      channel: 'webhook', destination: 'https://siem.example.com/ingest',
    });
    expect(res.status).toBe(201);
    const stored = await env.CACHE.get('alert_rules:t1');
    expect(stored).not.toBeNull();
    const list = JSON.parse(stored!) as Array<{ destination: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]!.destination).toBe('https://siem.example.com/ingest');
  });

  it('returns 400 limit_exceeded when tenant already has 20 rules', async () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`, name: `rule${i}`, condition: 'trust_drop', channel: 'email',
      destination: `a${i}@x.com`, createdAt: '2026-05-01T00:00:00Z',
    }));
    await env.CACHE.put('alert_rules:t1', JSON.stringify(existing));
    const res = await api('POST', '/v1/alerts/rules', env, {
      name: 'r21', condition: 'hijack_attempt', channel: 'email',
      destination: 'sec@acme.com',
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('limit_exceeded');
  });
});

describe('GET /v1/alerts/rules', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns empty array when no rules configured', async () => {
    const res = await api('GET', '/v1/alerts/rules', env);
    const j = (await res.json()) as { data: unknown[] };
    expect(j.data).toEqual([]);
  });

  it('returns the seeded rules from KV', async () => {
    const seed = [{ id: 'r1', name: 'sec', condition: 'hijack_attempt', channel: 'email', destination: 'a@b.com', createdAt: 'x' }];
    await env.CACHE.put('alert_rules:t1', JSON.stringify(seed));
    const res = await api('GET', '/v1/alerts/rules', env);
    const j = (await res.json()) as { data: Array<{ id: string }> };
    expect(j.data).toHaveLength(1);
    expect(j.data[0]!.id).toBe('r1');
  });
});

describe('DELETE /v1/alerts/rules/:id', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns 404 when rule id is unknown', async () => {
    const res = await api('DELETE', '/v1/alerts/rules/nope', env);
    expect(res.status).toBe(404);
  });

  it('removes the rule from KV on happy path', async () => {
    const seed = [
      { id: 'r1', name: 'a', condition: 'hijack_attempt', channel: 'email', destination: 'a@b.com', createdAt: 'x' },
      { id: 'r2', name: 'b', condition: 'trust_drop', channel: 'email', destination: 'b@b.com', createdAt: 'x' },
    ];
    await env.CACHE.put('alert_rules:t1', JSON.stringify(seed));
    const res = await api('DELETE', '/v1/alerts/rules/r1', env);
    expect(res.status).toBe(200);
    const stored = JSON.parse((await env.CACHE.get('alert_rules:t1')) ?? '[]') as Array<{ id: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe('r2');
  });
});
