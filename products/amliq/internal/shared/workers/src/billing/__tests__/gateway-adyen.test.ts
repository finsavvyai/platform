import { describe, expect, it, vi } from 'vitest';
import { AdyenGateway } from '../gateway-adyen';
import type { PaymentIntent, RefundRequest } from '../gateway-models';
import { PaymentDeclinedError, WebhookVerificationError, GatewayError } from '../gateway-models';

const NOW = '2026-07-20T12:00:00Z';

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

function makeGateway(fetchFn?: typeof fetch): AdyenGateway {
  return new AdyenGateway(
    { apiKeyEnvVar: 'ADYEN_KEY', merchantAccount: 'TestMerchant', hmacKeyEnvVar: 'ADYEN_HMAC', testMode: true },
    fetchFn as unknown as (url: string, init: RequestInit) => Promise<Response>,
  );
}

const testIntent: PaymentIntent = {
  id: 'pi-002', gateway: 'adyen', amount: 150.00, currency: 'EUR',
  customer_id: 'cust-2', status: 'created', created_at: NOW,
};

describe('AdyenGateway.authorize', () => {
  it('authorizes payment successfully', async () => {
    const gw = makeGateway(mockFetch(200, { pspReference: 'PSP-123', resultCode: 'Authorised' }));
    const result = await gw.authorize(testIntent);
    expect(result.success).toBe(true);
    expect(result.status).toBe('authorized');
    expect(result.gateway_reference).toBe('PSP-123');
  });

  it('throws PaymentDeclinedError on Refused', async () => {
    const gw = makeGateway(mockFetch(200, { pspReference: 'PSP-999', resultCode: 'Refused' }));
    await expect(gw.authorize(testIntent)).rejects.toThrow(PaymentDeclinedError);
  });

  it('throws GatewayError on HTTP error', async () => {
    const gw = makeGateway(mockFetch(500, { error: 'server error' }));
    await expect(gw.authorize(testIntent)).rejects.toThrow(GatewayError);
  });
});

describe('AdyenGateway.capture', () => {
  it('captures payment successfully', async () => {
    const gw = makeGateway(mockFetch(200, { pspReference: 'CAP-456', status: 'received' }));
    const result = await gw.capture('PSP-123', 150);
    expect(result.success).toBe(true);
    expect(result.status).toBe('captured');
  });

  it('captures without explicit amount', async () => {
    const gw = makeGateway(mockFetch(200, { pspReference: 'CAP-789', status: 'received' }));
    const result = await gw.capture('PSP-123');
    expect(result.success).toBe(true);
  });
});

describe('AdyenGateway.refund', () => {
  const refundReq: RefundRequest = {
    payment_id: 'PSP-123', amount: 50, currency: 'EUR', reason: 'Partial refund',
  };

  it('refunds successfully', async () => {
    const gw = makeGateway(mockFetch(200, { pspReference: 'REF-001' }));
    const result = await gw.refund(refundReq);
    expect(result.success).toBe(true);
    expect(result.status).toBe('refunded');
  });

  it('throws on network error', async () => {
    const gw = makeGateway(mockFetch(503, { error: 'unavailable' }));
    await expect(gw.refund(refundReq)).rejects.toThrow(GatewayError);
  });
});

describe('AdyenGateway.void', () => {
  it('voids payment successfully', async () => {
    const gw = makeGateway(mockFetch(200, {}));
    const result = await gw.void('PSP-123');
    expect(result.success).toBe(true);
    expect(result.status).toBe('voided');
  });
});

describe('AdyenGateway.verifyWebhook', () => {
  it('throws on missing HMAC header', async () => {
    const gw = makeGateway();
    await expect(gw.verifyWebhook({}, '{}')).rejects.toThrow(WebhookVerificationError);
  });

  it('throws on HMAC mismatch', async () => {
    const gw = makeGateway();
    await expect(gw.verifyWebhook(
      { 'x-adyen-hmac-signature': 'invalid-signature' },
      JSON.stringify({ notificationItems: [{ NotificationRequestItem: { eventCode: 'AUTH', pspReference: 'psp-1' } }] }),
    )).rejects.toThrow(WebhookVerificationError);
  });
});

describe('AdyenGateway.name', () => {
  it('returns adyen', () => {
    expect(makeGateway().name).toBe('adyen');
  });
});
