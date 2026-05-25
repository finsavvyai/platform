import { describe, expect, it, vi } from 'vitest';
import { PayPalGateway } from '../gateway-paypal';
import type { PaymentIntent, RefundRequest } from '../gateway-models';
import { PaymentDeclinedError, WebhookVerificationError } from '../gateway-models';

const NOW = '2026-07-20T12:00:00Z';

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

function makeGateway(fetchFn?: typeof fetch): PayPalGateway {
  return new PayPalGateway(
    { clientIdEnvVar: 'PP_CLIENT', secretEnvVar: 'PP_SECRET', webhookIdEnvVar: 'PP_WH', sandbox: true },
    fetchFn as unknown as (url: string, init: RequestInit) => Promise<Response>,
  );
}

const testIntent: PaymentIntent = {
  id: 'pi-001', gateway: 'paypal', amount: 99.99, currency: 'USD',
  customer_id: 'cust-1', status: 'created', created_at: NOW,
};

describe('PayPalGateway.authorize', () => {
  it('creates a PayPal order on success', async () => {
    const gw = makeGateway(mockFetch(201, { id: 'ORDER-123', status: 'CREATED' }));
    const result = await gw.authorize(testIntent);
    expect(result.success).toBe(true);
    expect(result.status).toBe('authorized');
    expect(result.gateway_reference).toBe('ORDER-123');
  });

  it('throws PaymentDeclinedError on 422', async () => {
    const gw = makeGateway(mockFetch(422, { error: 'declined' }));
    await expect(gw.authorize(testIntent)).rejects.toThrow(PaymentDeclinedError);
  });
});

describe('PayPalGateway.capture', () => {
  it('captures an authorized order', async () => {
    const gw = makeGateway(mockFetch(200, { id: 'CAP-1', status: 'COMPLETED' }));
    const result = await gw.capture('ORDER-123');
    expect(result.success).toBe(true);
    expect(result.status).toBe('captured');
  });

  it('returns failed on non-COMPLETED status', async () => {
    const gw = makeGateway(mockFetch(200, { id: 'CAP-1', status: 'PENDING' }));
    const result = await gw.capture('ORDER-123');
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
  });
});

describe('PayPalGateway.refund', () => {
  const refundReq: RefundRequest = {
    payment_id: 'CAP-1', amount: 50, currency: 'USD', reason: 'Customer request',
  };

  it('processes a refund successfully', async () => {
    const gw = makeGateway(mockFetch(200, { id: 'REF-1', status: 'COMPLETED' }));
    const result = await gw.refund(refundReq);
    expect(result.success).toBe(true);
    expect(result.status).toBe('refunded');
  });
});

describe('PayPalGateway.void', () => {
  it('voids an uncaptured authorization', async () => {
    const gw = makeGateway(mockFetch(200, {}));
    const result = await gw.void('ORDER-123');
    expect(result.success).toBe(true);
    expect(result.status).toBe('voided');
  });
});

describe('PayPalGateway.verifyWebhook', () => {
  it('verifies a valid webhook', async () => {
    const gw = makeGateway();
    const event = await gw.verifyWebhook(
      {
        'paypal-transmission-id': 'txn-123',
        'paypal-transmission-sig': 'sig-abc',
        'paypal-cert-url': 'https://www.paypal.com/certs/123',
      },
      JSON.stringify({ id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    );
    expect(event.verified).toBe(true);
    expect(event.event_type).toBe('PAYMENT.CAPTURE.COMPLETED');
    expect(event.gateway).toBe('paypal');
  });

  it('throws on missing transmission-id header', async () => {
    const gw = makeGateway();
    await expect(gw.verifyWebhook(
      { 'paypal-transmission-sig': 'sig', 'paypal-cert-url': 'https://www.paypal.com/cert' },
      '{}',
    )).rejects.toThrow(WebhookVerificationError);
  });

  it('throws on invalid cert URL domain', async () => {
    const gw = makeGateway();
    await expect(gw.verifyWebhook(
      {
        'paypal-transmission-id': 'txn',
        'paypal-transmission-sig': 'sig',
        'paypal-cert-url': 'https://evil.com/fake-cert',
      },
      '{}',
    )).rejects.toThrow(WebhookVerificationError);
  });
});

describe('PayPalGateway.name', () => {
  it('returns paypal', () => {
    const gw = makeGateway();
    expect(gw.name).toBe('paypal');
  });
});
