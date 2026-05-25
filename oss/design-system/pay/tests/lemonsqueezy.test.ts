import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LemonSqueezyClient } from '../src/lemonsqueezy/client.js';
import { PaymentError } from '../src/types.js';

global.fetch = vi.fn();

describe('LemonSqueezyClient', () => {
  let client: LemonSqueezyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LemonSqueezyClient('api_key_123', 'webhook_secret_123');
  });

  it('should have correct name', () => {
    expect(client.name).toBe('lemonsqueezy');
  });

  it('should create checkout session', async () => {
    const mockResponse = {
      data: {
        id: 'checkout_123',
        type: 'checkouts',
        attributes: {
          checkout_data: {
            checkout_url: 'https://checkout.lemonsqueezy.com/checkout_123',
          },
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const session = await client.createCheckout({
      customerId: 'cus_123',
      priceId: 'variant_123',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(session.id).toBe('checkout_123');
    expect(session.url).toBe('https://checkout.lemonsqueezy.com/checkout_123');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('checkouts'), expect.any(Object));
  });

  it('should handle checkout creation failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    await expect(
      client.createCheckout({
        customerId: 'cus_123',
        priceId: 'variant_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow(PaymentError);
  });

  it('should fetch subscription', async () => {
    const mockResponse = {
      data: {
        id: 'sub_123',
        type: 'subscriptions',
        attributes: {
          customer_id: 'cus_123',
          status: 'active',
          renews_at: new Date().toISOString(),
          variant_id: 'variant_123',
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const sub = await client.getSubscription('sub_123');

    expect(sub.id).toBe('sub_123');
    expect(sub.customerId).toBe('cus_123');
    expect(sub.status).toBe('active');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('subscriptions/sub_123'), expect.any(Object));
  });

  it('should handle subscription not found', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(client.getSubscription('sub_notfound')).rejects.toThrow(PaymentError);
  });

  it('should cancel subscription', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'sub_123', status: 'cancelled' } }),
    });

    await expect(client.cancelSubscription('sub_123')).resolves.not.toThrow();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('subscriptions/sub_123'), {
      method: 'DELETE',
      headers: expect.any(Object),
    });
  });

  it('should handle cancel subscription failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    });

    await expect(client.cancelSubscription('sub_123')).rejects.toThrow(PaymentError);
  });

  it('should handle webhook', async () => {
    const payload = JSON.stringify({
      meta: { event_name: 'subscription_created' },
      data: { id: 'sub_123' },
    });

    const signature = 'fakehash';

    vi.spyOn(client, 'handleWebhook').mockResolvedValueOnce({
      type: 'subscription.created',
      data: { id: 'sub_123' },
    });

    const event = await client.handleWebhook(signature, payload);
    expect(event.type).toBe('subscription.created');
  });

  it('should use authorization header with api key', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: 'sub_123',
          attributes: { status: 'active' },
        },
      }),
    });

    await client.getSubscription('sub_123');

    const calls = (global.fetch as any).mock.calls;
    const headers = calls[0][1].headers;
    expect(headers.Authorization).toContain('Bearer api_key_123');
  });

  it('should extract store id from variant id', async () => {
    const mockResponse = {
      data: {
        id: 'checkout_123',
        type: 'checkouts',
        attributes: {
          checkout_data: {
            checkout_url: 'https://checkout.lemonsqueezy.com/checkout_123',
          },
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await client.createCheckout({
      customerId: 'cus_123',
      priceId: '12345_variant_abc',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    const callBody = (global.fetch as any).mock.calls[0][1].body;
    expect(callBody).toContain('12345');
  });
});
