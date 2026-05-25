/**
 * Payment integration tests for Luna-OS Wave 1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPaymentProvider } from '../src/payment/provider';
import { getPlan, validatePlanId, getAllPlans } from '../src/payment/plans';
import { verifyWebhookSignature, parseWebhookEvent } from '../src/payment/webhook';
import {
  createMockUser,
  createMockSubscription,
  mockEnv,
} from './fixtures';

describe('Payment Provider Factory', () => {
  it('should create a LemonSqueezy payment provider', () => {
    const provider = createPaymentProvider('lemonsqueezy', {
      apiKey: mockEnv.LEMONSQUEEZY_API_KEY,
      storeId: mockEnv.LEMONSQUEEZY_STORE_ID,
    });

    expect(provider).toBeDefined();
    expect(provider.checkout).toBeDefined();
    expect(provider.handleWebhook).toBeDefined();
  });

  it('should throw error for missing API key', () => {
    expect(() =>
      createPaymentProvider('lemonsqueezy', {
        apiKey: '',
        storeId: 'test-store',
      })
    ).toThrow('LemonSqueezy API key required');
  });

  it('should throw error for missing store ID', () => {
    expect(() =>
      createPaymentProvider('lemonsqueezy', {
        apiKey: 'test-key',
        storeId: '',
      })
    ).toThrow('LemonSqueezy store ID required');
  });

  it('should throw error for unknown provider type', () => {
    expect(() =>
      createPaymentProvider('unknown' as any, {
        apiKey: 'test',
        storeId: 'test',
      })
    ).toThrow('Unknown payment provider');
  });
});

describe('Payment Plans', () => {
  it('should return free plan', () => {
    const plan = getPlan('free');
    expect(plan.id).toBe('free');
    expect(plan.price).toBe(0);
    expect(plan.features.length).toBeGreaterThan(0);
  });

  it('should return pro plan', () => {
    const plan = getPlan('pro');
    expect(plan.id).toBe('pro');
    expect(plan.price).toBeGreaterThan(0);
  });

  it('should return team plan', () => {
    const plan = getPlan('team');
    expect(plan.id).toBe('team');
    expect(plan.price).toBe(79);
  });

  it('should throw error for invalid plan', () => {
    expect(() => getPlan('invalid' as any)).toThrow('Plan not found');
  });

  it('should return all plans', () => {
    const plans = getAllPlans();
    expect(plans.length).toBe(3);
  });

  it('should validate plan IDs correctly', () => {
    expect(validatePlanId('free')).toBe(true);
    expect(validatePlanId('pro')).toBe(true);
    expect(validatePlanId('team')).toBe(true);
    expect(validatePlanId('invalid')).toBe(false);
  });
});

describe('Webhook Handling', () => {
  it('should verify webhook signature', async () => {
    const body = '{"test": "data"}';
    const result = await verifyWebhookSignature(
      'sha256=invalid',
      body
    );
    expect(typeof result).toBe('boolean');
  });

  it('should parse webhook event', () => {
    const body = '{"meta": {"event_name": "order_created"}}';
    const event = parseWebhookEvent(body);
    expect(event.meta).toBeDefined();
  });

  it('should throw error for invalid JSON', () => {
    expect(() => parseWebhookEvent('invalid json')).toThrow();
  });
});

describe('Subscription Models', () => {
  it('should create mock subscription', () => {
    const subscription = createMockSubscription();
    expect(subscription.id).toBeDefined();
    expect(subscription.userId).toBeDefined();
    expect(subscription.status).toBe('active');
  });

  it('should allow subscription overrides', () => {
    const subscription = createMockSubscription({
      planId: 'team',
      status: 'cancelled',
    });
    expect(subscription.planId).toBe('team');
    expect(subscription.status).toBe('cancelled');
  });

  it('should have valid date ranges', () => {
    const subscription = createMockSubscription();
    expect(subscription.currentPeriodStart.getTime()).toBeLessThan(
      subscription.currentPeriodEnd.getTime()
    );
  });
});
