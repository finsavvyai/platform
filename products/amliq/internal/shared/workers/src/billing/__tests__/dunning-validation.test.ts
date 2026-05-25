import { describe, expect, it } from 'vitest';
import {
  createDunningConfigSchema,
  updateDunningConfigSchema,
  dunningWebhookSchema,
  manualRetrySchema,
  dunningStatusQuerySchema,
  dunningDashboardQuerySchema,
} from '../dunning-validation';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-03-01T00:00:00Z';

describe('createDunningConfigSchema', () => {
  it('accepts valid config', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [1, 3, 5, 7],
      max_retries: 4,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty intervals', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [],
      max_retries: 4,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid final action', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 1,
      grace_period_days: 0,
      final_action: 'delete',
    });
    expect(result.success).toBe(false);
  });

  it('rejects intervals count exceeding max_retries', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [1, 2, 3, 4, 5],
      max_retries: 3,
      grace_period_days: 0,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative grace period', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 1,
      grace_period_days: -1,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_retries exceeding 10', () => {
    const result = createDunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 11,
      grace_period_days: 0,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateDunningConfigSchema', () => {
  it('accepts partial update with single field', () => {
    const result = updateDunningConfigSchema.safeParse({
      max_retries: 5,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all fields as optional', () => {
    const result = updateDunningConfigSchema.safeParse({
      retry_intervals_days: [1, 3],
      final_action: 'pause',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = updateDunningConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid values in partial updates', () => {
    const result = updateDunningConfigSchema.safeParse({
      max_retries: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('dunningWebhookSchema', () => {
  const validWebhook = {
    type: 'invoice.payment_failed',
    data: {
      subscription_id: VALID_UUID,
      invoice_id: VALID_UUID,
      tenant_id: VALID_UUID,
      amount: 49.99,
      currency: 'USD',
    },
    event_id: 'evt_123abc',
    timestamp: VALID_DATETIME,
  };

  it('accepts valid Stripe payment_failed webhook', () => {
    const result = dunningWebhookSchema.safeParse(validWebhook);
    expect(result.success).toBe(true);
  });

  it('accepts LemonSqueezy payment_failed webhook', () => {
    const result = dunningWebhookSchema.safeParse({
      ...validWebhook,
      type: 'subscription_payment_failed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported webhook type', () => {
    const result = dunningWebhookSchema.safeParse({
      ...validWebhook,
      type: 'customer.created',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid subscription UUID in data', () => {
    const result = dunningWebhookSchema.safeParse({
      ...validWebhook,
      data: { ...validWebhook.data, subscription_id: 'bad' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = dunningWebhookSchema.safeParse({
      ...validWebhook,
      data: { ...validWebhook.data, amount: -10 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing event_id', () => {
    const { event_id, ...rest } = validWebhook;
    const result = dunningWebhookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('accepts optional failure reason and payment method type', () => {
    const result = dunningWebhookSchema.safeParse({
      ...validWebhook,
      data: {
        ...validWebhook.data,
        failure_reason: 'Card declined',
        payment_method_type: 'visa',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('manualRetrySchema', () => {
  it('accepts valid manual retry request', () => {
    const result = manualRetrySchema.safeParse({
      reason: 'Customer updated payment method',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = manualRetrySchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('defaults override_idempotency to false', () => {
    const result = manualRetrySchema.safeParse({
      reason: 'Retry requested',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.override_idempotency).toBe(false);
    }
  });

  it('rejects reason exceeding 500 characters', () => {
    const result = manualRetrySchema.safeParse({
      reason: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('dunningStatusQuerySchema', () => {
  it('accepts valid query with defaults', () => {
    const result = dunningStatusQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('accepts query with filters', () => {
    const result = dunningStatusQuerySchema.safeParse({
      subscription_id: VALID_UUID,
      status: 'active',
      page: 2,
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date ordering', () => {
    const result = dunningStatusQuerySchema.safeParse({
      from_date: '2026-03-10T00:00:00Z',
      to_date: '2026-03-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit exceeding 100', () => {
    const result = dunningStatusQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});

describe('dunningDashboardQuerySchema', () => {
  it('accepts valid dashboard query', () => {
    const result = dunningDashboardQuerySchema.safeParse({
      period: 'week',
    });
    expect(result.success).toBe(true);
  });

  it('defaults period to month', () => {
    const result = dunningDashboardQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe('month');
    }
  });

  it('rejects invalid period', () => {
    const result = dunningDashboardQuerySchema.safeParse({
      period: 'yearly',
    });
    expect(result.success).toBe(false);
  });
});
