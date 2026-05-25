import { describe, expect, it } from 'vitest';
import {
  createSubscriptionSchema,
  listQuerySchema,
  sanitizeMetadata,
  validateInput
} from '../validation-schemas';

describe('billing validation schemas', () => {
  it('accepts a valid subscription payload', () => {
    const result = validateInput(createSubscriptionSchema, {
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      plan_id: '550e8400-e29b-41d4-a716-446655440001',
      billing_cycle: 'monthly',
      quantity: 2
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(2);
    }
  });

  it('rejects invalid UUID values', () => {
    const result = validateInput(createSubscriptionSchema, {
      customer_id: 'cust_123',
      plan_id: '550e8400-e29b-41d4-a716-446655440001',
      billing_cycle: 'monthly'
    });

    expect(result.success).toBe(false);
  });

  it('requires payment method when trial period is provided', () => {
    const result = validateInput(createSubscriptionSchema, {
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      plan_id: '550e8400-e29b-41d4-a716-446655440001',
      billing_cycle: 'monthly',
      trial_period_days: 7
    });

    expect(result.success).toBe(false);
  });

  it('validates query date ordering', () => {
    const result = validateInput(listQuerySchema, {
      from_date: '2026-02-01T00:00:00Z',
      to_date: '2026-01-01T00:00:00Z'
    });

    expect(result.success).toBe(false);
  });

  it('sanitizes metadata with supported value types only', () => {
    const sanitized = sanitizeMetadata({
      okString: ' hello ',
      okNumber: 123,
      okBoolean: true,
      okArray: [1, 2, 3],
      nested: { remove: true },
      fn: () => 'remove'
    });

    expect(sanitized.okString).toBe('hello');
    expect(sanitized.okNumber).toBe(123);
    expect(sanitized.okBoolean).toBe(true);
    expect(sanitized.okArray).toEqual([1, 2, 3]);
    expect(sanitized).not.toHaveProperty('nested');
    expect(sanitized).not.toHaveProperty('fn');
  });
});

