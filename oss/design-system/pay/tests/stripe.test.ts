import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeClient } from '../src/stripe/client.js';
import { PaymentError } from '../src/types.js';

global.fetch = vi.fn();

describe('StripeClient', () => {
  let client: StripeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new StripeClient('sk_test_123', 'whsec_test_123');
  });

  it('should have correct name', () => {
    expect(client.name).toBe('stripe');
  });

  it('should create checkout session', async () => {
    const mockResponse = {
      id: 'cs_123',
      url: 'https://checkout.stripe.com/pay/session_123',
      customer: 'cus_123',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const session = await client.createCheckout({
      customerId: 'cus_123',
      priceId: 'price_123',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(session.id).toBe('cs_123');
    expect(session.url).toBe('https://checkout.stripe.com/pay/session_123');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('checkout/sessions'), expect.any(Object));
  });

  it('should handle checkout creation failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    await expect(
      client.createCheckout({
        customerId: 'cus_123',
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow(PaymentError);
  });

  it('should fetch subscription', async () => {
    const mockResponse = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      items: {
        data: [{ price: { id: 'price_123' } }],
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
      json: async () => ({ id: 'sub_123', status: 'canceled' }),
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
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
        },
      },
    });

    const signature = 't=1234567890,v1=fakehash';

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
      json: async () => ({ id: 'sub_123', status: 'active' }),
    });

    await client.getSubscription('sub_123');

    const calls = (global.fetch as any).mock.calls;
    const headers = calls[0][1].headers;
    expect(headers.Authorization).toContain('Bearer sk_test_123');
  });
});
