import { describe, expect, it } from 'vitest';
import {
  dunningConfigSchema,
  dunningAttemptSchema,
  dunningScheduleSchema,
  dunningNotificationSchema,
  createDefaultDunningConfig,
  generateIdempotencyKey,
  calculateNextRetryAt,
  DunningFinalAction,
  DunningAttemptStatus,
  DunningScheduleStatus,
} from '../dunning-models';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-03-01T00:00:00Z';

describe('DunningConfig schema', () => {
  it('accepts a valid dunning config', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [1, 3, 5, 7],
      max_retries: 4,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all final action types', () => {
    for (const action of ['cancel', 'pause', 'downgrade']) {
      const result = dunningConfigSchema.safeParse({
        retry_intervals_days: [1],
        max_retries: 1,
        grace_period_days: 0,
        final_action: action,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty retry intervals', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [],
      max_retries: 4,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 retry intervals', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      max_retries: 4,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative retry interval values', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [-1, 3],
      max_retries: 2,
      grace_period_days: 3,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid final action', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 1,
      grace_period_days: 0,
      final_action: 'delete',
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_retries exceeding 10', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 11,
      grace_period_days: 0,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });

  it('rejects grace_period_days exceeding 30', () => {
    const result = dunningConfigSchema.safeParse({
      retry_intervals_days: [1],
      max_retries: 1,
      grace_period_days: 31,
      final_action: 'cancel',
    });
    expect(result.success).toBe(false);
  });
});

describe('DunningAttempt schema', () => {
  it('accepts a valid attempt', () => {
    const result = dunningAttemptSchema.safeParse({
      attempt_number: 1,
      scheduled_at: VALID_DATETIME,
      executed_at: null,
      status: 'pending',
      error_message: null,
      payment_provider_response: null,
      idempotency_key: 'dunning_abc_attempt_1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a failed attempt with error details', () => {
    const result = dunningAttemptSchema.safeParse({
      attempt_number: 2,
      scheduled_at: VALID_DATETIME,
      executed_at: VALID_DATETIME,
      status: 'failed',
      error_message: 'Card declined',
      payment_provider_response: '{"code":"card_declined"}',
      idempotency_key: 'dunning_abc_attempt_2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects attempt_number less than 1', () => {
    const result = dunningAttemptSchema.safeParse({
      attempt_number: 0,
      scheduled_at: VALID_DATETIME,
      executed_at: null,
      status: 'pending',
      error_message: null,
      payment_provider_response: null,
      idempotency_key: 'key',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = dunningAttemptSchema.safeParse({
      attempt_number: 1,
      scheduled_at: VALID_DATETIME,
      executed_at: null,
      status: 'unknown',
      error_message: null,
      payment_provider_response: null,
      idempotency_key: 'key',
    });
    expect(result.success).toBe(false);
  });
});

describe('DunningSchedule schema', () => {
  const validSchedule = {
    id: VALID_UUID,
    subscription_id: VALID_UUID,
    invoice_id: VALID_UUID,
    tenant_id: VALID_UUID,
    config: {
      retry_intervals_days: [1, 3],
      max_retries: 2,
      grace_period_days: 3,
      final_action: 'cancel',
    },
    attempts: [],
    current_status: 'active',
    next_retry_at: VALID_DATETIME,
    created_at: VALID_DATETIME,
    updated_at: VALID_DATETIME,
  };

  it('accepts a valid schedule', () => {
    const result = dunningScheduleSchema.safeParse(validSchedule);
    expect(result.success).toBe(true);
  });

  it('accepts null next_retry_at for exhausted schedules', () => {
    const result = dunningScheduleSchema.safeParse({
      ...validSchedule,
      current_status: 'exhausted',
      next_retry_at: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid subscription_id', () => {
    const result = dunningScheduleSchema.safeParse({
      ...validSchedule,
      subscription_id: 'bad-id',
    });
    expect(result.success).toBe(false);
  });
});

describe('DunningNotification schema', () => {
  it('accepts a valid notification', () => {
    const result = dunningNotificationSchema.safeParse({
      id: VALID_UUID,
      schedule_id: VALID_UUID,
      type: 'payment_failed',
      recipient_email: 'user@example.com',
      sent_at: null,
      template_vars: { amount: '$49.99', plan: 'Pro' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = dunningNotificationSchema.safeParse({
      id: VALID_UUID,
      schedule_id: VALID_UUID,
      type: 'payment_failed',
      recipient_email: 'not-an-email',
      sent_at: null,
      template_vars: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('createDefaultDunningConfig', () => {
  it('returns valid default config', () => {
    const config = createDefaultDunningConfig();
    expect(config.retry_intervals_days).toEqual([1, 3, 5, 7]);
    expect(config.max_retries).toBe(4);
    expect(config.grace_period_days).toBe(3);
    expect(config.final_action).toBe('cancel');
    const result = dunningConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe('generateIdempotencyKey', () => {
  it('generates deterministic key from schedule and attempt', () => {
    const key = generateIdempotencyKey('abc-123', 2);
    expect(key).toBe('dunning_abc-123_attempt_2');
  });

  it('produces different keys for different attempts', () => {
    const key1 = generateIdempotencyKey('abc', 1);
    const key2 = generateIdempotencyKey('abc', 2);
    expect(key1).not.toBe(key2);
  });
});

describe('calculateNextRetryAt', () => {
  const config = createDefaultDunningConfig();
  const baseDate = new Date('2026-03-01T12:00:00Z');

  it('returns date offset by first interval for attempt 0', () => {
    const next = calculateNextRetryAt(config, 0, baseDate);
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe('2026-03-02T12:00:00.000Z');
  });

  it('returns date offset by second interval for attempt 1', () => {
    const next = calculateNextRetryAt(config, 1, baseDate);
    expect(next).not.toBeNull();
    expect(next!.toISOString()).toBe('2026-03-04T12:00:00.000Z');
  });

  it('clamps to last interval when attempt exceeds intervals array', () => {
    const next = calculateNextRetryAt(config, 5, baseDate);
    expect(next).toBeNull();
  });

  it('returns null when attempt equals max_retries', () => {
    const next = calculateNextRetryAt(config, 4, baseDate);
    expect(next).toBeNull();
  });

  it('returns null when attempt exceeds max_retries', () => {
    const next = calculateNextRetryAt(config, 10, baseDate);
    expect(next).toBeNull();
  });
});

describe('enum constants', () => {
  it('exposes final action values', () => {
    expect(DunningFinalAction.CANCEL).toBe('cancel');
    expect(DunningFinalAction.PAUSE).toBe('pause');
    expect(DunningFinalAction.DOWNGRADE).toBe('downgrade');
  });

  it('exposes attempt status values', () => {
    expect(DunningAttemptStatus.PENDING).toBe('pending');
    expect(DunningAttemptStatus.PROCESSING).toBe('processing');
    expect(DunningAttemptStatus.SUCCEEDED).toBe('succeeded');
    expect(DunningAttemptStatus.FAILED).toBe('failed');
  });

  it('exposes schedule status values', () => {
    expect(DunningScheduleStatus.ACTIVE).toBe('active');
    expect(DunningScheduleStatus.SUCCEEDED).toBe('succeeded');
    expect(DunningScheduleStatus.EXHAUSTED).toBe('exhausted');
    expect(DunningScheduleStatus.CANCELLED).toBe('cancelled');
  });
});
