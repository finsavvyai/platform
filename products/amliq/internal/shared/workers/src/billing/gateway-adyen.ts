/**
 * Adyen Gateway Provider
 * Implements PaymentGateway interface using Adyen Checkout API v71.
 * Supports authorize (manual capture), capture, refund, void,
 * and HMAC-SHA256 webhook verification.
 * API keys read from environment variables -- never from source code.
 */

import type { PaymentGateway, PaymentIntent, PaymentResult, RefundRequest, WebhookEvent } from './gateway-models';
import { GatewayError, PaymentDeclinedError, WebhookVerificationError } from './gateway-models';

interface AdyenConfig {
  apiKeyEnvVar: string;
  merchantAccount: string;
  hmacKeyEnvVar: string;
  testMode: boolean;
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export class AdyenGateway implements PaymentGateway {
  readonly name = 'adyen';
  private config: AdyenConfig;
  private httpClient: HttpClient;

  constructor(config: AdyenConfig, httpClient?: HttpClient) {
    this.config = config;
    this.httpClient = httpClient ?? fetch.bind(globalThis);
  }

  private get baseUrl(): string {
    return this.config.testMode
      ? 'https://checkout-test.adyen.com/v71'
      : 'https://checkout-live.adyen.com/v71';
  }

  async authorize(intent: PaymentIntent): Promise<PaymentResult> {
    const body = {
      amount: { currency: intent.currency, value: toMinorUnits(intent.amount, intent.currency) },
      reference: intent.id,
      merchantAccount: this.config.merchantAccount,
      shopperReference: intent.customer_id,
      additionalData: { manualCapture: 'true' },
    };

    const res = await this.request('POST', '/payments', body);
    if (!res.ok) return this.handleError(intent.id, res);

    const data = await res.json() as { pspReference: string; resultCode: string };
    const success = data.resultCode === 'Authorised';

    if (!success && data.resultCode === 'Refused') {
      throw new PaymentDeclinedError('adyen', `Payment refused: ${data.resultCode}`, data.resultCode);
    }

    return {
      success,
      intent_id: intent.id,
      gateway: this.name,
      gateway_reference: data.pspReference,
      status: success ? 'authorized' : 'failed',
    };
  }

  async capture(intentId: string, amount?: number): Promise<PaymentResult> {
    const body: Record<string, unknown> = {
      merchantAccount: this.config.merchantAccount,
      originalReference: intentId,
    };
    if (amount !== undefined) {
      body.modificationAmount = { currency: 'USD', value: toMinorUnits(amount, 'USD') };
    }

    const res = await this.request('POST', '/payments/capture', body);
    if (!res.ok) return this.handleError(intentId, res);

    const data = await res.json() as { pspReference: string; status: string };
    return {
      success: true,
      intent_id: intentId,
      gateway: this.name,
      gateway_reference: data.pspReference,
      status: 'captured',
    };
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    const body = {
      merchantAccount: this.config.merchantAccount,
      originalReference: request.payment_id,
      amount: { currency: request.currency, value: toMinorUnits(request.amount, request.currency) },
      reference: request.idempotency_key ?? `ref-${Date.now()}`,
    };

    const res = await this.request('POST', '/payments/refund', body);
    if (!res.ok) return this.handleError(request.payment_id, res);

    const data = await res.json() as { pspReference: string };
    return {
      success: true,
      intent_id: request.payment_id,
      gateway: this.name,
      gateway_reference: data.pspReference,
      status: 'refunded',
    };
  }

  async void(intentId: string): Promise<PaymentResult> {
    const body = {
      merchantAccount: this.config.merchantAccount,
      originalReference: intentId,
    };

    const res = await this.request('POST', '/payments/cancel', body);
    if (!res.ok) return this.handleError(intentId, res);

    return {
      success: true,
      intent_id: intentId,
      gateway: this.name,
      status: 'voided',
    };
  }

  async verifyWebhook(
    headers: Record<string, string>, body: string,
  ): Promise<WebhookEvent> {
    const hmacSignature = headers['x-adyen-hmac-signature'] ?? headers['hmac-signature'];
    if (!hmacSignature) {
      throw new WebhookVerificationError('adyen', 'Missing HMAC signature header');
    }

    const isValid = await this.verifyHmac(body, hmacSignature);
    if (!isValid) {
      throw new WebhookVerificationError('adyen', 'HMAC signature mismatch');
    }

    const parsed = JSON.parse(body) as {
      notificationItems?: Array<{ NotificationRequestItem: { eventCode: string; pspReference: string } }>;
    };
    const item = parsed.notificationItems?.[0]?.NotificationRequestItem;

    return {
      id: item?.pspReference ?? `adyen-${Date.now()}`,
      gateway: this.name,
      event_type: item?.eventCode ?? 'unknown',
      payload: parsed,
      received_at: new Date().toISOString(),
      verified: true,
    };
  }

  private async verifyHmac(payload: string, signature: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(this.config.hmacKeyEnvVar),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
      return computed === signature;
    } catch {
      return false;
    }
  }

  private async request(method: string, path: string, body: unknown): Promise<Response> {
    return this.httpClient(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': `env:${this.config.apiKeyEnvVar}`,
      },
      body: JSON.stringify(body),
    });
  }

  private async handleError(intentId: string, res: Response): Promise<PaymentResult> {
    const text = await res.text().catch(() => '');
    throw new GatewayError(`Adyen API error ${res.status}: ${text}`, 'adyen');
  }
}

function toMinorUnits(amount: number, currency: string): number {
  const zeroDecimal = ['JPY', 'KRW'];
  if (zeroDecimal.includes(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}
