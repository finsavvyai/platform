import { describe, expect, it, vi } from 'vitest';
import { GatewayRouter, type RoutingRule, routingRuleSchema } from '../gateway-router';
import { GatewayRegistry, GatewayError, type PaymentGateway, type PaymentIntent } from '../gateway-models';

const NOW = '2026-07-20T12:00:00Z';

function makeMockGateway(name: string, shouldFail = false): PaymentGateway {
  return {
    name,
    authorize: shouldFail
      ? vi.fn().mockRejectedValue(new GatewayError(`${name} failed`, name))
      : vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'authorized' }),
    capture: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'captured' }),
    refund: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'refunded' }),
    void: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'voided' }),
    verifyWebhook: vi.fn().mockResolvedValue({ id: 'evt-1', gateway: name, event_type: 'test', payload: {}, received_at: NOW, verified: true }),
  };
}

function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: 'pi-test', gateway: 'stripe', amount: 100, currency: 'USD',
    customer_id: 'cust-1', status: 'created', created_at: NOW,
    ...overrides,
  };
}

describe('routingRuleSchema', () => {
  it('accepts a valid rule', () => {
    const result = routingRuleSchema.safeParse({
      id: 'rule-1',
      conditions: { currency: 'EUR' },
      preferred_gateway: 'adyen',
      fallback_gateway: 'stripe',
      priority: 10,
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal rule', () => {
    const result = routingRuleSchema.safeParse({
      id: 'rule-2', conditions: {}, preferred_gateway: 'stripe',
    });
    expect(result.success).toBe(true);
  });
});

describe('GatewayRouter.route', () => {
  it('routes to preferred gateway by currency', () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'));
    registry.register('adyen', makeMockGateway('adyen'));

    const router = new GatewayRouter(registry);
    router.setRules([
      { id: 'r1', conditions: { currency: 'EUR' }, preferred_gateway: 'adyen', priority: 10 },
      { id: 'r2', conditions: {}, preferred_gateway: 'stripe', priority: 0 },
    ]);

    const gw = router.route(makeIntent({ currency: 'EUR' }));
    expect(gw.name).toBe('adyen');
  });

  it('falls back to default when no rule matches', () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'), true);
    const router = new GatewayRouter(registry);
    router.setRules([]);

    const gw = router.route(makeIntent());
    expect(gw.name).toBe('stripe');
  });

  it('throws when no healthy gateway available', () => {
    const registry = new GatewayRegistry();
    const router = new GatewayRouter(registry);
    expect(() => router.route(makeIntent())).toThrow('No healthy gateway available');
  });
});

describe('GatewayRouter.processPayment', () => {
  it('processes payment via primary gateway', async () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'), true);

    const router = new GatewayRouter(registry);
    router.setRules([{ id: 'r1', conditions: {}, preferred_gateway: 'stripe', priority: 0 }]);

    const result = await router.processPayment(makeIntent());
    expect(result.success).toBe(true);
    expect(result.gateway).toBe('stripe');
  });

  it('fails over to fallback on primary failure', async () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe', true));
    registry.register('paypal', makeMockGateway('paypal'));

    const router = new GatewayRouter(registry);
    router.setRules([{
      id: 'r1', conditions: {}, preferred_gateway: 'stripe',
      fallback_gateway: 'paypal', priority: 0,
    }]);

    const result = await router.processPayment(makeIntent());
    expect(result.success).toBe(true);
    expect(result.gateway).toBe('paypal');
  });

  it('throws when both primary and fallback fail', async () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe', true));
    registry.register('paypal', makeMockGateway('paypal', true));

    const router = new GatewayRouter(registry);
    router.setRules([{
      id: 'r1', conditions: {}, preferred_gateway: 'stripe',
      fallback_gateway: 'paypal', priority: 0,
    }]);

    await expect(router.processPayment(makeIntent())).rejects.toThrow();
  });
});

describe('GatewayRouter.getHealth', () => {
  it('returns health for all registered gateways', () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'));
    registry.register('paypal', makeMockGateway('paypal'));

    const router = new GatewayRouter(registry);
    const health = router.getHealth();
    expect(health).toHaveLength(2);
    expect(health[0].gateway).toBe('stripe');
    expect(health[0].isHealthy).toBe(true);
  });

  it('tracks success and failure counts', async () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'), true);
    const router = new GatewayRouter(registry);
    router.setRules([{ id: 'r1', conditions: {}, preferred_gateway: 'stripe', priority: 0 }]);

    await router.processPayment(makeIntent());
    const health = router.getHealth();
    expect(health[0].successCount).toBe(1);
    expect(health[0].failureCount).toBe(0);
  });
});

describe('Circuit breaker', () => {
  it('opens circuit after 5 failures', async () => {
    const registry = new GatewayRegistry();
    const failGw = makeMockGateway('stripe', true);
    const goodGw = makeMockGateway('paypal');
    registry.register('stripe', failGw);
    registry.register('paypal', goodGw);

    const router = new GatewayRouter(registry);
    router.setRules([{
      id: 'r1', conditions: {}, preferred_gateway: 'stripe',
      fallback_gateway: 'paypal', priority: 0,
    }]);

    // 5 failures to trip circuit breaker
    for (let i = 0; i < 5; i++) {
      await router.processPayment(makeIntent());
    }

    // 6th request should go directly to paypal since stripe circuit is open
    const result = await router.processPayment(makeIntent());
    expect(result.gateway).toBe('paypal');

    const health = router.getHealth();
    const stripeHealth = health.find((h) => h.gateway === 'stripe');
    expect(stripeHealth?.isHealthy).toBe(false);
  });
});
