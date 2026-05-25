import { describe, expect, it } from 'vitest';
import {
  paymentIntentSchema,
  paymentResultSchema,
  refundRequestSchema,
  webhookEventSchema,
  gatewayConfigSchema,
  GatewayRegistry,
  GatewayError,
  PaymentDeclinedError,
  WebhookVerificationError,
  type PaymentGateway,
  type PaymentIntent,
  type PaymentResult,
} from '../gateway-models';

const NOW = '2026-07-20T12:00:00Z';

function makeMockGateway(name: string): PaymentGateway {
  return {
    name,
    authorize: async () => ({ success: true, intent_id: 'pi-1', gateway: name, status: 'authorized' }),
    capture: async () => ({ success: true, intent_id: 'pi-1', gateway: name, status: 'captured' }),
    refund: async () => ({ success: true, intent_id: 'pi-1', gateway: name, status: 'refunded' }),
    void: async () => ({ success: true, intent_id: 'pi-1', gateway: name, status: 'voided' }),
    verifyWebhook: async () => ({
      id: 'evt-1', gateway: name, event_type: 'payment.captured',
      payload: {}, received_at: NOW, verified: true,
    }),
  };
}

describe('paymentIntentSchema', () => {
  const valid: PaymentIntent = {
    id: 'pi-001',
    gateway: 'stripe',
    amount: 99.99,
    currency: 'USD',
    customer_id: 'cust-1',
    status: 'created',
    created_at: NOW,
  };

  it('accepts a valid payment intent', () => {
    expect(paymentIntentSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects negative amount', () => {
    expect(paymentIntentSchema.safeParse({ ...valid, amount: -10 }).success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(paymentIntentSchema.safeParse({ ...valid, status: 'unknown' }).success).toBe(false);
  });

  it('rejects invalid currency code', () => {
    expect(paymentIntentSchema.safeParse({ ...valid, currency: 'us' }).success).toBe(false);
  });
});

describe('paymentResultSchema', () => {
  it('accepts a valid result', () => {
    const result = paymentResultSchema.safeParse({
      success: true, intent_id: 'pi-1', gateway: 'stripe', status: 'captured',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a failed result with error', () => {
    const result = paymentResultSchema.safeParse({
      success: false, intent_id: 'pi-1', gateway: 'paypal',
      status: 'failed', error_code: 'DECLINED', error_message: 'Card declined',
    });
    expect(result.success).toBe(true);
  });
});

describe('refundRequestSchema', () => {
  it('accepts a valid refund request', () => {
    const result = refundRequestSchema.safeParse({
      payment_id: 'pay-1', amount: 50, currency: 'USD', reason: 'Customer request',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing reason', () => {
    const result = refundRequestSchema.safeParse({
      payment_id: 'pay-1', amount: 50, currency: 'USD',
    });
    expect(result.success).toBe(false);
  });
});

describe('webhookEventSchema', () => {
  it('accepts a valid webhook event', () => {
    const result = webhookEventSchema.safeParse({
      id: 'evt-1', gateway: 'adyen', event_type: 'AUTHORISATION',
      payload: { amount: 100 }, received_at: NOW, verified: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('gatewayConfigSchema', () => {
  it('accepts a valid config', () => {
    const result = gatewayConfigSchema.safeParse({
      provider: 'stripe', api_key_env_var: 'STRIPE_SECRET_KEY',
      environment: 'production', enabled: true, display_name: 'Stripe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid provider', () => {
    const result = gatewayConfigSchema.safeParse({
      provider: 'bitcoin', api_key_env_var: 'KEY', environment: 'sandbox',
      display_name: 'BTC',
    });
    expect(result.success).toBe(false);
  });

  it('defaults enabled to true', () => {
    const result = gatewayConfigSchema.safeParse({
      provider: 'paypal', api_key_env_var: 'PAYPAL_KEY',
      environment: 'sandbox', display_name: 'PayPal',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.enabled).toBe(true);
  });
});

describe('GatewayRegistry', () => {
  it('registers and retrieves a gateway', () => {
    const registry = new GatewayRegistry();
    const gw = makeMockGateway('stripe');
    registry.register('stripe', gw);
    expect(registry.get('stripe')).toBe(gw);
  });

  it('returns undefined for unregistered gateway', () => {
    const registry = new GatewayRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('sets first registered as default', () => {
    const registry = new GatewayRegistry();
    const gw = makeMockGateway('stripe');
    registry.register('stripe', gw);
    expect(registry.getDefault()).toBe(gw);
  });

  it('allows explicit default override', () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'));
    const paypal = makeMockGateway('paypal');
    registry.register('paypal', paypal, true);
    expect(registry.getDefault()).toBe(paypal);
  });

  it('lists all registered gateways', () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', makeMockGateway('stripe'));
    registry.register('paypal', makeMockGateway('paypal'));
    expect(registry.list()).toEqual(['stripe', 'paypal']);
  });

  it('has() returns true for registered', () => {
    const registry = new GatewayRegistry();
    registry.register('adyen', makeMockGateway('adyen'));
    expect(registry.has('adyen')).toBe(true);
    expect(registry.has('stripe')).toBe(false);
  });
});

describe('Error types', () => {
  it('GatewayError includes gateway name', () => {
    const err = new GatewayError('timeout', 'stripe', 'TIMEOUT');
    expect(err.message).toBe('timeout');
    expect(err.gateway).toBe('stripe');
    expect(err.code).toBe('TIMEOUT');
    expect(err.name).toBe('GatewayError');
  });

  it('PaymentDeclinedError formats message', () => {
    const err = new PaymentDeclinedError('paypal', 'Insufficient funds', 'FUNDS');
    expect(err.message).toContain('Insufficient funds');
    expect(err.name).toBe('PaymentDeclinedError');
  });

  it('WebhookVerificationError formats message', () => {
    const err = new WebhookVerificationError('adyen', 'Invalid HMAC');
    expect(err.message).toContain('Invalid HMAC');
    expect(err.name).toBe('WebhookVerificationError');
  });
});
