import { describe, it, expect, beforeEach } from 'vitest';
import { createPaymentClient, createPaymentClientFromEnv } from '../src/factory.js';
import { StripeClient } from '../src/stripe/client.js';
import { LemonSqueezyClient } from '../src/lemonsqueezy/client.js';
import { PaymentError } from '../src/types.js';

describe('Factory', () => {
  beforeEach(() => {
    delete process.env.STRIPE_API_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.LEMONSQUEEZY_API_KEY;
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  });

  it('should create stripe client', () => {
    const client = createPaymentClient('stripe', {
      apiKey: 'sk_test_123',
      webhookSecret: 'whsec_test_123',
    });

    expect(client).toBeInstanceOf(StripeClient);
    expect(client.name).toBe('stripe');
  });

  it('should create lemonsqueezy client', () => {
    const client = createPaymentClient('lemonsqueezy', {
      apiKey: 'api_key_123',
      webhookSecret: 'webhook_secret_123',
    });

    expect(client).toBeInstanceOf(LemonSqueezyClient);
    expect(client.name).toBe('lemonsqueezy');
  });

  it('should throw on missing api key', () => {
    expect(() =>
      createPaymentClient('stripe', {
        apiKey: '',
        webhookSecret: 'whsec_test_123',
      }),
    ).toThrow(PaymentError);
  });

  it('should throw on missing webhook secret', () => {
    expect(() =>
      createPaymentClient('stripe', {
        apiKey: 'sk_test_123',
        webhookSecret: '',
      }),
    ).toThrow(PaymentError);
  });

  it('should create from env variables for stripe', () => {
    process.env.STRIPE_API_KEY = 'sk_test_from_env';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_from_env';

    const client = createPaymentClientFromEnv('stripe');

    expect(client).toBeInstanceOf(StripeClient);
  });

  it('should create from env variables for lemonsqueezy', () => {
    process.env.LEMONSQUEEZY_API_KEY = 'api_from_env';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'secret_from_env';

    const client = createPaymentClientFromEnv('lemonsqueezy');

    expect(client).toBeInstanceOf(LemonSqueezyClient);
  });

  it('should throw when env variables missing', () => {
    expect(() => createPaymentClientFromEnv('stripe')).toThrow(PaymentError);
  });
});
