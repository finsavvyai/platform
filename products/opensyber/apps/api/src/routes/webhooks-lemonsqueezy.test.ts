import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, generateHmacSignature } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('../services/email.js', () => ({
  emailService: {
    sendPaymentFailedEmail: vi.fn(async () => undefined),
  },
}));

import { lemonSqueezyWebhookRoutes } from './webhooks-lemonsqueezy.js';
import { emailService } from '../services/email.js';

function buildWebhookPayload(
  eventName: string,
  overrides: Record<string, unknown> = {},
  customData: Record<string, unknown> = {},
) {
  return {
    meta: { event_name: eventName, custom_data: { user_id: 'user_test123', ...customData } },
    data: {
      id: 'sub_123',
      attributes: {
        store_id: 12345,
        customer_id: 99999,
        order_id: 55555,
        product_id: 100,
        variant_id: 200,
        status: 'active',
        card_brand: 'visa',
        renews_at: '2026-04-26T00:00:00.000Z',
        ends_at: null,
        cancelled: false,
        ...overrides,
      },
    },
  };
}

describe('LemonSqueezy Webhook Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.env = mockEnv;
      c.set('db', mockDb as any);
      await next();
    });
    app.route('/webhooks', lemonSqueezyWebhookRoutes);
  });

  async function postWebhook(payload: unknown) {
    const body = JSON.stringify(payload);
    const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, body);
    return app.request('/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
      body,
    });
  }

  // ── Signature Verification ─────────────────────────────────

  describe('signature verification', () => {
    it('rejects request without X-Signature header', async () => {
      const res = await app.request('/webhooks/lemonsqueezy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Missing signature');
    });

    it('rejects request with invalid signature', async () => {
      const res = await app.request('/webhooks/lemonsqueezy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': 'invalid-signature' },
        body: JSON.stringify(buildWebhookPayload('subscription_created')),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid signature');
    });

    it('accepts request with valid HMAC-SHA256 signature', async () => {
      const payload = buildWebhookPayload('subscription_payment_success');
      const res = await postWebhook(payload);
      expect(res.status).toBe(200);
    });
  });

  // ── Product Filtering ──────────────────────────────────────

  describe('product filtering', () => {
    it('ignores events for other products', async () => {
      const payload = buildWebhookPayload('subscription_created', { product_id: 999 });
      const res = await postWebhook(payload);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ignored).toBe(true);
    });

    it('processes events for OpenSyber product ID', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', referredBy: null }],
      ]);
      const payload = buildWebhookPayload('subscription_created', { product_id: 100 });
      const res = await postWebhook(payload);
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ── subscription_created ───────────────────────────────────

  describe('subscription_created', () => {
    it('updates user plan to personal for variant 200', async () => {
      mockDb._setSelectResults([[{ id: 'user_test123', referredBy: null }]]);
      const payload = buildWebhookPayload('subscription_created', { variant_id: 200 });
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'personal',
          lemonSqueezyCustomerId: '99999',
          lemonSqueezySubscriptionId: 'sub_123',
        }),
      );
    });

    it('updates user plan to pro for variant 201', async () => {
      mockDb._setSelectResults([[{ id: 'user_test123', referredBy: null }]]);
      const payload = buildWebhookPayload('subscription_created', { variant_id: 201 });
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'pro' }),
      );
    });

    it('updates user plan to team for variant 202', async () => {
      mockDb._setSelectResults([[{ id: 'user_test123', referredBy: null }]]);
      const payload = buildWebhookPayload('subscription_created', { variant_id: 202 });
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'team' }),
      );
    });

    it('awards referral credit when user has referredBy', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_test123', referredBy: 'REF-abc123' }],
      ]);
      const payload = buildWebhookPayload('subscription_created');
      await postWebhook(payload);

      // update called twice: once for plan, once for referral credit
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('skips processing when user_id missing from custom_data', async () => {
      const payload = buildWebhookPayload('subscription_created', {}, { user_id: undefined });
      delete (payload.meta.custom_data as any).user_id;
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ── subscription_updated ───────────────────────────────────

  describe('subscription_updated', () => {
    it('updates plan when user found by customer ID', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_abc', lemonSqueezyCustomerId: '99999' }],
      ]);
      const payload = buildWebhookPayload('subscription_updated', { variant_id: 201 });
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'pro' }),
      );
    });

    it('does nothing when customer not found', async () => {
      mockDb._setSelectResults([[]]);
      const payload = buildWebhookPayload('subscription_updated');
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      // update called once for select, but set not called for plan change
      expect(mockDb._updateChain.set).not.toHaveBeenCalled();
    });
  });

  // ── subscription_cancelled / expired ───────────────────────

  describe('subscription_cancelled', () => {
    it('downgrades user to free plan', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_abc', lemonSqueezyCustomerId: '99999', paymentGraceUntil: null }],
        [], // instances query returns empty
      ]);
      const payload = buildWebhookPayload('subscription_cancelled');
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'free',
          lemonSqueezySubscriptionId: null,
        }),
      );
    });

    it('suspends excess instances beyond free limit', async () => {
      const instances = [
        { id: 'inst_1', createdAt: '2026-01-01', status: 'running' },
        { id: 'inst_2', createdAt: '2026-02-01', status: 'running' },
        { id: 'inst_3', createdAt: '2026-03-01', status: 'running' },
      ];
      mockDb._setSelectResults([
        [{ id: 'user_abc', lemonSqueezyCustomerId: '99999', paymentGraceUntil: null }],
        instances,
      ]);
      const payload = buildWebhookPayload('subscription_cancelled');
      await postWebhook(payload);

      // update called: 1 for plan downgrade + 2 for suspending excess instances (free limit = 1)
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('defers suspension when user in grace period', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockDb._setSelectResults([
        [{ id: 'user_abc', lemonSqueezyCustomerId: '99999', paymentGraceUntil: futureDate }],
      ]);
      const payload = buildWebhookPayload('subscription_cancelled');
      await postWebhook(payload);

      // Should not update plan — grace period active
      expect(mockDb._updateChain.set).not.toHaveBeenCalled();
    });
  });

  describe('subscription_expired', () => {
    it('downgrades user to free plan same as cancelled', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_abc', lemonSqueezyCustomerId: '99999', paymentGraceUntil: null }],
        [],
      ]);
      const payload = buildWebhookPayload('subscription_expired');
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'free' }),
      );
    });
  });

  // ── subscription_payment_failed ────────────────────────────

  describe('subscription_payment_failed', () => {
    it('sets 3-day grace period and sends email', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_abc', email: 'test@example.com', name: 'Test', lemonSqueezyCustomerId: '99999' }],
      ]);
      const payload = buildWebhookPayload('subscription_payment_failed');
      const res = await postWebhook(payload);

      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentGraceUntil: expect.any(String),
        }),
      );
      expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          userName: 'Test',
        }),
      );
    });

    it('handles email send failure gracefully', async () => {
      mockDb._setSelectResults([
        [{ id: 'user_abc', email: 'test@example.com', name: 'Test', lemonSqueezyCustomerId: '99999' }],
      ]);
      vi.mocked(emailService.sendPaymentFailedEmail).mockRejectedValueOnce(new Error('Email failed'));

      const payload = buildWebhookPayload('subscription_payment_failed');
      const res = await postWebhook(payload);

      expect(res.status).toBe(200); // should not crash
    });
  });

  // ── subscription_payment_success ───────────────────────────

  describe('subscription_payment_success', () => {
    it('returns 200 and logs (no DB action)', async () => {
      const payload = buildWebhookPayload('subscription_payment_success');
      const res = await postWebhook(payload);
      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ── Variant Map ────────────────────────────────────────────

  describe('variant mapping', () => {
    it('maps all three variant IDs to correct plans', async () => {
      const variants = [
        { variant_id: 200, expected: 'personal' },
        { variant_id: 201, expected: 'pro' },
        { variant_id: 202, expected: 'team' },
      ];

      for (const { variant_id, expected } of variants) {
        vi.clearAllMocks();
        mockDb._setSelectResults([[{ id: 'user_test123', referredBy: null }]]);
        const payload = buildWebhookPayload('subscription_created', { variant_id });
        await postWebhook(payload);

        expect(mockDb._updateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({ plan: expected }),
        );
      }
    });

    it('defaults to personal for unknown variant', async () => {
      mockDb._setSelectResults([[{ id: 'user_test123', referredBy: null }]]);
      const payload = buildWebhookPayload('subscription_created', { variant_id: 999 });
      await postWebhook(payload);

      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'personal' }),
      );
    });
  });
});
