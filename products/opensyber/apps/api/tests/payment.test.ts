/**
 * Unit tests for payment module.
 * Tests payment provider, plans, and webhook handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { getPlanConfig, getAllPlans, isValidPlan } from '../src/payment/plans';
import { LemonSqueezyProvider } from '../src/payment/provider';
import type { LemonSqueezyConfig } from '../src/payment/types';

describe('Payment Plans', () => {
  it('should return free plan config', () => {
    const plan = getPlanConfig('free');
    expect(plan.id).toBe('free');
    expect(plan.name).toBe('Free');
    expect(plan.price).toBe(0);
  });

  it('should return pro plan config', () => {
    const plan = getPlanConfig('pro');
    expect(plan.id).toBe('pro');
    expect(plan.name).toBe('Pro');
    expect(plan.price).toBeGreaterThan(0);
    expect(plan.features.length).toBeGreaterThan(0);
  });

  it('should return enterprise plan config', () => {
    const plan = getPlanConfig('enterprise');
    expect(plan.id).toBe('enterprise');
    expect(plan.name).toBe('Enterprise');
    expect(plan.price).toBeGreaterThan(0);
    expect(plan.features.length).toBeGreaterThan(0);
  });

  it('should throw error for invalid plan', () => {
    expect(() => getPlanConfig('invalid' as 'free')).toThrow();
  });

  it('should return all plans', () => {
    const plans = getAllPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map(p => p.id)).toEqual(['free', 'pro', 'enterprise']);
  });

  it('should validate plan IDs', () => {
    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('pro')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
    expect(isValidPlan('invalid')).toBe(false);
  });
});

describe('LemonSqueezy Provider', () => {
  const config: LemonSqueezyConfig = {
    apiKey: 'test-api-key',
    storeId: 'test-store-id',
    productId: 'test-product-id',
    webhookSecret: 'test-webhook-secret',
    plans: {
      pro: {
        id: 'pro',
        name: 'Pro',
        variantId: 'variant-pro',
        price: 2999,
        currency: 'USD',
        features: [],
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        variantId: 'variant-enterprise',
        price: 9999,
        currency: 'USD',
        features: [],
      },
    },
  };

  it('should create LemonSqueezy provider', () => {
    const provider = new LemonSqueezyProvider(config);
    expect(provider).toBeDefined();
  });

  it('should get plan config from provider', () => {
    const provider = new LemonSqueezyProvider(config);
    const plan = provider.getPlan('free');
    expect(plan.id).toBe('free');
  });

  it('should handle free plan checkout without external call', async () => {
    const provider = new LemonSqueezyProvider(config);
    const session = await provider.createCheckout('free', 'user-123');

    expect(session.sessionId).toBe('free_user-123');
    expect(session.checkoutUrl).toBe('/dashboard');
  });

  it('should handle webhook events with a valid HMAC-SHA256 signature', async () => {
    const provider = new LemonSqueezyProvider(config);
    const eventBody = JSON.stringify({
      meta: { event_name: 'subscription_created' },
      data: {
        id: 'event-123',
        attributes: {
          status: 'active',
          checkout_data: { custom: { userId: 'user-123' } },
        },
      },
    });
    const signature = await signHmacHex(config.webhookSecret, eventBody);
    const event = await provider.handleWebhook(signature, eventBody);
    expect(event.id).toBe('event-123');
    expect(event.type).toBe('subscription_created');
  });

  it('should reject webhook with invalid signature', async () => {
    const provider = new LemonSqueezyProvider(config);
    const eventBody = JSON.stringify({ meta: { event_name: 'x' }, data: { id: '1', attributes: {} } });
    await expect(provider.handleWebhook('deadbeef', eventBody)).rejects.toThrow('Invalid webhook signature');
  });

  it('should reject webhook with empty signature even if body is non-empty', async () => {
    const provider = new LemonSqueezyProvider(config);
    await expect(provider.handleWebhook('', '{"meta":{"event_name":"x"},"data":{"id":"1","attributes":{}}}'))
      .rejects.toThrow('Invalid webhook signature');
  });
});

async function signHmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Payment Provider Interface', () => {
  const config: LemonSqueezyConfig = {
    apiKey: 'test-api-key',
    storeId: 'test-store-id',
    productId: 'test-product-id',
    webhookSecret: 'test-webhook-secret',
    plans: {
      pro: {
        id: 'pro',
        name: 'Pro',
        variantId: 'variant-pro',
        price: 2999,
        currency: 'USD',
        features: [],
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        variantId: 'variant-enterprise',
        price: 9999,
        currency: 'USD',
        features: [],
      },
    },
  };

  it('should implement PaymentProvider interface', () => {
    const provider = new LemonSqueezyProvider(config);
    expect(provider.createCheckout).toBeDefined();
    expect(provider.handleWebhook).toBeDefined();
    expect(provider.getPlan).toBeDefined();
  });
});
