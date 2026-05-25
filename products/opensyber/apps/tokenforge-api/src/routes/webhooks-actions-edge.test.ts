/**
 * Edge-case coverage for /v1/webhooks/:id/{rotate,test,deliveries}.
 * Sibling of webhooks-actions.test.ts (175L) — pins rotate DB-set shape,
 * audit emission, test payload completeness, default+NaN limit handling.
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

const { mockDispatchWebhook, mockLogAudit } = vi.hoisted(() => ({
  mockDispatchWebhook: vi.fn(async () => undefined),
  mockLogAudit: vi.fn(async () => undefined),
}));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: mockDispatchWebhook }));
vi.mock('../services/audit-log.js', () => ({ logAudit: mockLogAudit }));

import worker from '../index.js';

async function api(method: string, path: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

let env: Env;
let db: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /:id/rotate — DB shape + audit', () => {
  it('DB.update.set carries new secret AND old secret as secretPrevious (grace continuity)', async () => {
    db._setSelectResult([{ id: 'wh_1', tenantId: 't1', secret: 'whsec_OLD000000' }]);
    await api('POST', '/v1/webhooks/wh_1/rotate', env);
    const setArg = db._updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg.secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    expect(setArg.secret).not.toBe('whsec_OLD000000');
    expect(setArg.secretPrevious).toBe('whsec_OLD000000');
    expect(typeof setArg.secretPreviousValidUntil).toBe('string');
    expect(setArg.updatedAt).toBeDefined();
  });

  it('writes webhook.secret_rotated audit event with webhookId in payload', async () => {
    db._setSelectResult([{ id: 'wh_1', tenantId: 't1', secret: 'whsec_old' }]);
    await api('POST', '/v1/webhooks/wh_1/rotate', env);
    expect(mockLogAudit).toHaveBeenCalled();
    const call = mockLogAudit.mock.calls[0]!;
    expect(call[1]).toBe('webhook.secret_rotated');
    expect(call[2]).toBe('t1');
    expect((call[3] as { webhookId: string }).webhookId).toBe('wh_1');
  });

  it('first-time rotate (no prior secret) → secretPrevious=null + secretPreviousValidUntil=null', async () => {
    db._setSelectResult([{ id: 'wh_2', tenantId: 't1', secret: null }]);
    await api('POST', '/v1/webhooks/wh_2/rotate', env);
    const setArg = db._updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg.secretPrevious).toBeNull();
    expect(setArg.secretPreviousValidUntil).toBeNull();
  });
});

describe('POST /:id/test — dispatch payload', () => {
  it('dispatchWebhook called with webhook.test event AND payload has message + webhookId', async () => {
    db._setSelectResult([{ id: 'wh_1' }]);
    await api('POST', '/v1/webhooks/wh_1/test', env);
    const args = mockDispatchWebhook.mock.calls[0]!;
    expect(args[2]).toBe('webhook.test');
    const payload = args[3] as Record<string, unknown>;
    expect(payload.webhookId).toBe('wh_1');
    expect(typeof payload.message).toBe('string');
    expect((payload.message as string).length).toBeGreaterThan(0);
  });
});

describe('GET /:id/deliveries — limit handling', () => {
  it('default limit=25 when no query param', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }) })),
        })),
      })),
    })) as unknown as typeof db.select;
    await api('GET', '/v1/webhooks/wh_1/deliveries', env);
    expect(captured).toBe(25);
  });

  it('non-numeric limit (?limit=abc) falls back to 25 via the `|| 25` short-circuit', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }) })),
        })),
      })),
    })) as unknown as typeof db.select;
    await api('GET', '/v1/webhooks/wh_1/deliveries?limit=abc', env);
    expect(captured).toBe(25);
  });

  it('negative limit (?limit=-5) is clamped to 1 (Math.max guard, not passed to SQL)', async () => {
    let captured: number | undefined;
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn((n: number) => { captured = n; return Promise.resolve([]); }) })),
        })),
      })),
    })) as unknown as typeof db.select;
    await api('GET', '/v1/webhooks/wh_1/deliveries?limit=-5', env);
    expect(captured).toBe(1);
  });
});
