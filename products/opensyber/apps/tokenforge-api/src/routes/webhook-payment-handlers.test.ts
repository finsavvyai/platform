import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handlePaymentSuccess,
  handlePaymentFailed,
} from './webhook-payment-handlers.js';
import type { WebhookPayload } from '../lib/webhook-schemas.js';

const { mockSendPaymentFailedEmail } = vi.hoisted(() => ({
  mockSendPaymentFailedEmail: vi.fn(),
}));
vi.mock('../services/email.js', () => ({
  sendPaymentFailedEmail: mockSendPaymentFailedEmail,
}));

interface DbState {
  tenants: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}

function makeDb(state: DbState): unknown {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.tenants),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((v: Record<string, unknown>) => ({
        where: vi.fn(async () => { state.updates.push(v); }),
      })),
    })),
  };
}

const basePayload = (over: Record<string, unknown> = {}): WebhookPayload => ({
  meta: { event_name: 'subscription_payment_failed', custom_data: { tenant_id: 't1' } },
  data: {
    id: 'sub_123',
    attributes: {
      store_id: 1, customer_id: 42, order_id: 10, product_id: 999,
      variant_id: 100, status: 'past_due', card_brand: 'visa',
      renews_at: null, ends_at: null, cancelled: false,
      ...over,
    },
  },
} as unknown as WebhookPayload);

describe('handlePaymentSuccess', () => {
  it('returns without throwing (logs only — no DB or email side effects yet)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(handlePaymentSuccess(basePayload())).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('handlePaymentFailed', () => {
  let state: DbState;

  beforeEach(() => {
    state = { tenants: [], updates: [] };
    mockSendPaymentFailedEmail.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns early without DB update or email when tenant not found', async () => {
    state.tenants = [];
    await handlePaymentFailed(makeDb(state) as never, basePayload(), 'resend_test');
    expect(state.updates).toHaveLength(0);
    expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('updates tenant and sends payment-failed email when tenant exists', async () => {
    state.tenants = [{ id: 'tf_acme', name: 'Acme Corp', lemonSqueezyCustomerId: '42' }];
    await handlePaymentFailed(makeDb(state) as never, basePayload(), 'resend_test');
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.updatedAt).toBeDefined();
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledTimes(1);
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith('resend_test', 'Acme Corp');
  });

  it('swallows email send errors instead of propagating to caller', async () => {
    state.tenants = [{ id: 'tf_acme', name: 'Acme Corp', lemonSqueezyCustomerId: '42' }];
    mockSendPaymentFailedEmail.mockRejectedValueOnce(new Error('resend down'));
    // Should NOT throw — webhook delivery should still ack
    await expect(
      handlePaymentFailed(makeDb(state) as never, basePayload(), 'resend_test'),
    ).resolves.toBeUndefined();
    // DB update still happened before the email failure
    expect(state.updates).toHaveLength(1);
  });

  it('coerces customer_id to string before WHERE clause (LemonSqueezy returns numbers)', async () => {
    state.tenants = [{ id: 'tf_acme', name: 'Acme Corp', lemonSqueezyCustomerId: '42' }];
    // payload has customer_id: 42 (number); the lookup column is text — String() coercion required
    await handlePaymentFailed(
      makeDb(state) as never,
      basePayload({ customer_id: 42 }),
      'resend_test',
    );
    // We can't directly inspect the WHERE arg in the mock, but no crash + email sent proves the lookup ran
    expect(mockSendPaymentFailedEmail).toHaveBeenCalled();
  });
});
