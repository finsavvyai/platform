import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import {
  postLsWebhook,
  hmacSign,
  tfRequest,
  lsBody,
  lsBodyWithVariant,
} from '../test/webhook-fixtures.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

describe('Webhook Routes', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('400 when X-Signature missing', async () => {
    const r = await tfRequest('/webhooks/lemonsqueezy', { method: 'POST', body: '{}' }, env);
    expect(r.status).toBe(400);
  });

  it('401 when signature invalid', async () => {
    const r = await tfRequest(
      '/webhooks/lemonsqueezy',
      { method: 'POST', body: '{}', headers: { 'X-Signature': 'bad' } },
      env,
    );
    expect(r.status).toBe(401);
  });

  it('400 for invalid JSON', async () => {
    const raw = 'not json';
    const sig = await hmacSign(raw, env.LEMONSQUEEZY_WEBHOOK_SECRET);
    const r = await tfRequest(
      '/webhooks/lemonsqueezy',
      { method: 'POST', body: raw, headers: { 'X-Signature': sig } },
      env,
    );
    expect(r.status).toBe(400);
  });

  it('400 for invalid schema', async () => {
    const r = await postLsWebhook(JSON.stringify({ meta: {}, data: {} }), env);
    expect(r.status).toBe(400);
  });

  it('ignores wrong product ID', async () => {
    const r = await postLsWebhook(lsBody('subscription_created', 555), env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as Record<string, unknown>;
    expect(j.ignored).toBe(true);
  });

  it('handles subscription_created for existing tenant', async () => {
    db._setSelectResult([{ id: 'tenant-1', plan: 'free' }]);
    const r = await postLsWebhook(lsBody('subscription_created'), env);
    expect(r.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  it('handles subscription_updated', async () => {
    db._setSelectResult([{ id: 'tenant-1', plan: 'free' }]);
    const r = await postLsWebhook(lsBody('subscription_updated'), env);
    expect(r.status).toBe(200);
  });

  it('handles subscription_cancelled', async () => {
    db._setSelectResult([{ id: 'tenant-1', plan: 'pro' }]);
    const r = await postLsWebhook(lsBody('subscription_cancelled'), env);
    expect(r.status).toBe(200);
  });

  it('handles payment_failed', async () => {
    db._setSelectResult([{ id: 'tenant-1', name: 'Test' }]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const r = await postLsWebhook(lsBody('subscription_payment_failed'), env);
    expect(r.status).toBe(200);
  });

  it('handles payment_success (no DB action)', async () => {
    const r = await postLsWebhook(lsBody('subscription_payment_success'), env);
    expect(r.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('handles subscription_expired — downgrades to free', async () => {
    db._setSelectResult([{ id: 'tenant-1', plan: 'team', lemonSqueezyCustomerId: '42' }]);
    const r = await postLsWebhook(lsBody('subscription_expired'), env);
    expect(r.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  describe('variant mapping', () => {
    it('maps variant 100 to pro plan', async () => {
      db._setSelectResult([]);
      const r = await postLsWebhook(lsBodyWithVariant('subscription_created', 100), env);
      expect(r.status).toBe(200);
      expect(db.insert).toHaveBeenCalled();
    });

    it('maps variant 200 to team plan', async () => {
      db._setSelectResult([]);
      const r = await postLsWebhook(lsBodyWithVariant('subscription_created', 200), env);
      expect(r.status).toBe(200);
    });

    it('maps variant 300 to enterprise plan', async () => {
      db._setSelectResult([]);
      const r = await postLsWebhook(lsBodyWithVariant('subscription_created', 300), env);
      expect(r.status).toBe(200);
    });
  });

  describe('subscription_created — new tenant', () => {
    it('inserts tenant when not found', async () => {
      db._setSelectResult([]);
      const r = await postLsWebhook(lsBody('subscription_created'), env);
      expect(r.status).toBe(200);
      expect(db.insert).toHaveBeenCalled();
    });

    it('skips when tenant_id missing', async () => {
      const raw = JSON.stringify({
        meta: { event_name: 'subscription_created', custom_data: {} },
        data: { id: 'sub_123', attributes: {
          store_id: 1, customer_id: 42, product_id: 999,
          variant_id: 100, status: 'active',
        }},
      });
      const r = await postLsWebhook(raw, env);
      expect(r.status).toBe(200);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('subscription_cancelled — timing', () => {
    it('defers downgrade when ends_at is in the future', async () => {
      db._setSelectResult([{ id: 'tenant-1', lemonSqueezyCustomerId: '42' }]);
      const raw = JSON.stringify({
        meta: { event_name: 'subscription_cancelled', custom_data: { tenant_id: 'tenant-1' } },
        data: { id: 'sub_123', attributes: {
          store_id: 1, customer_id: 42, product_id: 999,
          variant_id: 100, status: 'cancelled',
          ends_at: '2099-12-31T00:00:00Z', renews_at: null,
        }},
      });
      const r = await postLsWebhook(raw, env);
      expect(r.status).toBe(200);
      // Should NOT call update with plan: 'free' — deferred
    });
  });
});
