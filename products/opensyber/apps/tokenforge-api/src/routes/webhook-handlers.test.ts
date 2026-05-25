import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import type { WebhookPayload } from '../lib/webhook-schemas.js';
import type { TfPlan } from '../types.js';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handleSubscriptionExpired,
  handlePaymentSuccess,
  handlePaymentFailed,
} from './webhook-handlers.js';

function makePayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    meta: {
      event_name: 'subscription_created',
      custom_data: { tenant_id: 'tenant-1' },
    },
    data: {
      id: 'sub_123',
      attributes: {
        store_id: 1,
        customer_id: 42,
        order_id: 10,
        product_id: 999,
        variant_id: 100,
        status: 'active',
        card_brand: 'visa',
        renews_at: '2026-03-01T00:00:00Z',
        ends_at: null,
        cancelled: false,
      },
    },
    ...overrides,
  };
}

const variantMap: Record<number, TfPlan> = {
  100: 'pro',
  200: 'team',
  300: 'enterprise',
};

describe('Webhook Handlers', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleSubscriptionCreated', () => {
    const created = (p: WebhookPayload) => handleSubscriptionCreated(
      mockDb as unknown as Parameters<typeof handleSubscriptionCreated>[0], p, variantMap);

    it('updates existing tenant plan', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'free' }]);
      await created(makePayload());
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro' }));
    });

    it('creates tenant if not exists', async () => {
      mockDb._setSelectResult([]);
      await created(makePayload());
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('does nothing without tenant_id', async () => {
      await created(makePayload({ meta: { event_name: 'subscription_created' } }));
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const update = (p: WebhookPayload) => handleSubscriptionUpdated(
      mockDb as unknown as Parameters<typeof handleSubscriptionUpdated>[0], p, variantMap);

    it('updates plan for existing tenant', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'free' }]);
      await update(makePayload());
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('does nothing if tenant not found', async () => {
      mockDb._setSelectResult([]);
      await update(makePayload());
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionCancelled', () => {
    it('downgrades immediately if period ended', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'pro' }]);
      const payload = makePayload({
        data: { id: 'sub_123', attributes: {
          store_id: 1, customer_id: 42, order_id: 10, product_id: 999, variant_id: 100,
          status: 'cancelled', card_brand: null, renews_at: null, ends_at: '2020-01-01T00:00:00Z', cancelled: true,
        } },
      });
      await handleSubscriptionCancelled(mockDb as unknown as Parameters<typeof handleSubscriptionCancelled>[0], payload);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }));
    });
  });

  describe('handlePaymentSuccess', () => {
    it('logs payment without error', async () => {
      const payload = makePayload();
      await expect(handlePaymentSuccess(payload)).resolves.toBeUndefined();
    });
  });

  describe('handlePaymentFailed', () => {
    it('sets grace period for tenant', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', name: 'Test' }]);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

      const payload = makePayload();
      await handlePaymentFailed(
        mockDb as unknown as Parameters<typeof handlePaymentFailed>[0],
        payload,
        'resend_test',
      );
      expect(mockDb.update).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('does nothing if tenant not found', async () => {
      mockDb._setSelectResult([]);
      const payload = makePayload();
      await handlePaymentFailed(
        mockDb as unknown as Parameters<typeof handlePaymentFailed>[0],
        payload,
        'resend_test',
      );
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionCancelled scheduled-downgrade path', () => {
    const cancelPayload = (renewsAt: string, endsAt: string | null): WebhookPayload => makePayload({
      data: {
        id: 'sub_123',
        attributes: {
          store_id: 1, customer_id: 42, order_id: 10, product_id: 999,
          variant_id: 100, status: 'cancelled', card_brand: 'visa',
          renews_at: renewsAt, ends_at: endsAt, cancelled: true,
        },
      },
    });
    const cancel = (p: WebhookPayload) =>
      handleSubscriptionCancelled(mockDb as unknown as Parameters<typeof handleSubscriptionCancelled>[0], p);

    it('does NOT mutate when ends_at is in the future (cron handles later)', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'pro', lemonSqueezyCustomerId: '42' }]);
      const future = new Date(Date.now() + 30 * 86400_000).toISOString();
      await cancel(cancelPayload(future, future));
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('falls back to renews_at when ends_at is null (downgrades when renews_at is past)', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'pro', lemonSqueezyCustomerId: '42' }]);
      await cancel(cancelPayload(new Date(Date.now() - 1000).toISOString(), null));
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionExpired', () => {
    const expire = (p: WebhookPayload) =>
      handleSubscriptionExpired(mockDb as unknown as Parameters<typeof handleSubscriptionExpired>[0], p);

    it('downgrades tenant to free + clears lemonSqueezySubscriptionId', async () => {
      mockDb._setSelectResult([{ id: 'tenant-1', plan: 'pro', lemonSqueezyCustomerId: '42' }]);
      await expire(makePayload());
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'free', lemonSqueezySubscriptionId: null }),
      );
    });

    it('does nothing when tenant not found by customer_id', async () => {
      mockDb._setSelectResult([]);
      await expire(makePayload());
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
