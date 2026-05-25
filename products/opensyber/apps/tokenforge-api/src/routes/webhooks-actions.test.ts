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

const { mockDispatchWebhook, mockLogAudit } = vi.hoisted(() => ({
  mockDispatchWebhook: vi.fn(async () => undefined),
  mockLogAudit: vi.fn(async () => undefined),
}));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: mockDispatchWebhook }));
vi.mock('../services/audit-log.js', () => ({ logAudit: mockLogAudit }));

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

describe('POST /v1/webhooks/:id/rotate', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 404 when webhook id is unknown', async () => {
    db._setSelectResult([]);
    const res = await api('POST', '/v1/webhooks/missing/rotate', env);
    expect(res.status).toBe(404);
    expect((await res.json() as { error: string }).error).toBe('not_found');
  });

  it('rotates: stores prior secret + grace window when prior secret present', async () => {
    db._setSelectResult([{ id: 'wh_1', tenantId: 't1', secret: 'whsec_old' }]);
    const res = await api('POST', '/v1/webhooks/wh_1/rotate', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { id: string; secret: string; gracePeriodEndsAt: string | null } };
    expect(j.data.id).toBe('wh_1');
    expect(j.data.secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    expect(j.data.gracePeriodEndsAt).not.toBeNull();
    // 24h ~ 86_400_000 ms after now
    const grace = new Date(j.data.gracePeriodEndsAt!).getTime();
    expect(grace).toBeGreaterThan(Date.now() + 23 * 60 * 60_000);
    expect(grace).toBeLessThan(Date.now() + 25 * 60 * 60_000);
    expect(db.update).toHaveBeenCalled();
  });

  it('rotates with gracePeriodEndsAt=null when no prior secret existed', async () => {
    db._setSelectResult([{ id: 'wh_2', tenantId: 't1', secret: null }]);
    const res = await api('POST', '/v1/webhooks/wh_2/rotate', env);
    const j = (await res.json()) as { data: { gracePeriodEndsAt: string | null } };
    expect(j.data.gracePeriodEndsAt).toBeNull();
  });
});

describe('POST /v1/webhooks/:id/test', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  it('returns 404 when webhook id is unknown', async () => {
    db._setSelectResult([]);
    const res = await api('POST', '/v1/webhooks/missing/test', env);
    expect(res.status).toBe(404);
  });

  it('queues a webhook.test dispatch and returns queued=true', async () => {
    db._setSelectResult([{ id: 'wh_1' }]);
    const res = await api('POST', '/v1/webhooks/wh_1/test', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { queued: boolean; message: string } };
    expect(j.data.queued).toBe(true);
    expect(j.data.message).toContain('Test delivery queued');
    expect(mockDispatchWebhook).toHaveBeenCalledTimes(1);
    const args = mockDispatchWebhook.mock.calls[0]!;
    expect(args[2]).toBe('webhook.test');
    expect((args[3] as { webhookId: string }).webhookId).toBe('wh_1');
  });
});

describe('GET /v1/webhooks/:id/deliveries', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  it('returns the delivery rows mapped to the API shape', async () => {
    db._setSelectResult([
      {
        id: 'd1', event: 'session.bound', attempt: 1, status: 200,
        error: null, scheduledAt: '2026-05-04T00:00:00Z',
        deliveredAt: '2026-05-04T00:00:01Z', nextRetryAt: null,
      },
    ]);
    const res = await api('GET', '/v1/webhooks/wh_1/deliveries', env);
    const j = (await res.json()) as { data: Array<{ id: string; event: string; status: number }> };
    expect(j.data).toHaveLength(1);
    expect(j.data[0]!.id).toBe('d1');
    expect(j.data[0]!.event).toBe('session.bound');
    expect(j.data[0]!.status).toBe(200);
  });

  it('clamps the limit query to [1, 100]', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }),
          })),
        })),
      })),
    })) as unknown as typeof db.select;
    await api('GET', '/v1/webhooks/wh_1/deliveries?limit=999', env);
    expect(captured).toBe(100);
    await api('GET', '/v1/webhooks/wh_1/deliveries?limit=0', env);
    // parseInt('0') is 0; the route does `parseInt(...) || 25` → 25 (the
    // `|| 25` short-circuits zero too), so clamped to min(100, 25) = 25
    expect(captured).toBe(25);
  });

  it('returns empty array when there are no deliveries', async () => {
    db._setSelectResult([]);
    const res = await api('GET', '/v1/webhooks/wh_1/deliveries', env);
    const j = (await res.json()) as { data: unknown[] };
    expect(j.data).toEqual([]);
  });
});
