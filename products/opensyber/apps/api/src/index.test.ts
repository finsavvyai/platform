import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb, mockAuthFetch } from './test/helpers.js';
import type { Env } from './types.js';

vi.mock('./lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test'));

import worker from './index.js';

// Helper: call the Worker fetch handler like app.request() did before
async function workerRequest(path: string, init: RequestInit = {}, env: Env) {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('API App (index.ts)', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    const mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET / returns API info', async () => {
    const res = await workerRequest('/', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.name).toBe('OpenSyber API');
    expect(body.version).toBe('0.3.0');
  });

  it('GET /health returns healthy', async () => {
    const res = await workerRequest('/health', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('healthy');
    expect(body.subsystems).toBeDefined();
    expect(body.subsystems.d1.status).toBe('ok');
    expect(body.subsystems.kv.status).toBe('ok');
    expect(body.subsystems.r2.status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await workerRequest('/nonexistent', {}, mockEnv);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Not found');
    expect(body.message).toContain('/nonexistent');
  });

  it('mounts /api/user routes', async () => {
    const res = await workerRequest('/api/user', {}, mockEnv);
    // Without auth it should return 401
    expect(res.status).toBe(401);
  });

  it('mounts /api/instances routes', async () => {
    const res = await workerRequest('/api/instances', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('mounts /webhooks routes', async () => {
    const res = await workerRequest(
      '/webhooks/lemonsqueezy',
      { method: 'POST', body: '{}' },
      mockEnv,
    );
    // Missing signature → 401
    expect(res.status).toBe(401);
  });

  it('CORS headers are set', async () => {
    const res = await workerRequest('/', {
      headers: { Origin: 'http://localhost:3000' },
    }, mockEnv);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('CORS allows X-TF-* headers', async () => {
    const res = await workerRequest('/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-TF-Signature',
      },
    }, mockEnv);
    const allowHeaders = res.headers.get('access-control-allow-headers') ?? '';
    expect(allowHeaders.toLowerCase()).toContain('x-tf-signature');
  });

  it('TokenForge middleware allows requests without TF headers (degraded)', async () => {
    // /api/skills is public — should still work without TF headers
    const res = await workerRequest('/api/skills', {}, mockEnv);
    expect(res.status).toBe(200);
  });

  it('mounts /api/skills routes', async () => {
    const res = await workerRequest('/api/skills', {}, mockEnv);
    // Skills are public, should return 200
    expect(res.status).toBe(200);
  });

  it('mounts /api/security routes', async () => {
    const res = await workerRequest('/api/security/instances/inst_1/dashboard', {}, mockEnv);
    // Without auth it should return 401
    expect(res.status).toBe(401);
  });

  it('exports a scheduled handler', () => {
    expect(worker.scheduled).toBeDefined();
    expect(typeof worker.scheduled).toBe('function');
  });

  it('mounts /api/badges routes (public)', async () => {
    const mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    mockDb._setSelectResult([]);

    const res = await workerRequest('/api/badges/inst_1/security-score', {}, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
  });

  it('mounts /api/user/onboarding routes', async () => {
    const res = await workerRequest('/api/user/onboarding', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('mounts /api/user/referral routes', async () => {
    const res = await workerRequest('/api/user/referral', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('scheduled handler calls all cron tasks', async () => {
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        pending.push(promise);
      }),
      passThroughOnException: vi.fn(),
    };
    await worker.scheduled!({} as ScheduledEvent, mockEnv, ctx as any);
    await Promise.allSettled(pending);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(6);
  });
});
