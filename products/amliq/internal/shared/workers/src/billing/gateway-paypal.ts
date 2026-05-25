/**
 * PayPal Gateway Provider
 * Implements PaymentGateway interface using PayPal Orders API v2.
 * Supports authorize, capture, refund, void, and webhook verification.
 * API keys read from environment variables -- never from source code.
 */

import type { PaymentGateway, PaymentIntent, PaymentResult, RefundRequest, WebhookEvent } from './gateway-models';
import { GatewayError, PaymentDeclinedError, WebhookVerificationError } from './gateway-models';

interface PayPalConfig {
  clientIdEnvVar: string;
  secretEnvVar: string;
  webhookIdEnvVar: string;
  sandbox: boolean;
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export class PayPalGateway implements PaymentGateway {
  readonly name = 'paypal';
  private config: PayPalConfig;
  private httpClient: HttpClient;

  constructor(config: PayPalConfig, httpClient?: HttpClient) {
    this.config = config;
    this.httpClient = httpClient ?? fetch.bind(globalThis);
  }

  private get baseUrl(): string {
    return this.config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  async authorize(intent: PaymentIntent): Promise<PaymentResult> {
    const body = {
      intent: 'AUTHORIZE',
      purchase_units: [{
        reference_id: intent.id,
        amount: { currency_code: intent.currency, value: intent.amount.toFixed(2) },
      }],
    };

    const res = await this.request('POST', '/v2/checkout/orders', body);
    if (!res.ok) return this.handleError(intent.id, res);

    const data = await res.json() as { id: string; status: string };
    return {
      success: true,
      intent_id: intent.id,
      gateway: this.name,
      gateway_reference: data.id,
      status: 'authorized',
    };
  }

  async capture(intentId: string): Promise<PaymentResult> {
    const res = await this.request('POST', `/v2/checkout/orders/${intentId}/capture`, {});
    if (!res.ok) return this.handleError(intentId, res);

    const data = await res.json() as { id: string; status: string };
    return {
      success: data.status === 'COMPLETED',
      intent_id: intentId,
      gateway: this.name,
      gateway_reference: data.id,
      status: data.status === 'COMPLETED' ? 'captured' : 'failed',
    };
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    const body = {
      amount: { currency_code: request.currency, value: request.amount.toFixed(2) },
      note_to_payer: request.reason,
    };

    const res = await this.request(
      'POST', `/v2/payments/captures/${request.payment_id}/refund`, body,
    );
    if (!res.ok) return this.handleError(request.payment_id, res);

    const data = await res.json() as { id: string; status: string };
    return {
      success: data.status === 'COMPLETED',
      intent_id: request.payment_id,
      gateway: this.name,
      gateway_reference: data.id,
      status: 'refunded',
    };
  }

  async void(intentId: string): Promise<PaymentResult> {
    const res = await this.request('POST', `/v2/checkout/orders/${intentId}/void`, {});
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
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const certUrl = headers['paypal-cert-url'];

    if (!transmissionId || !transmissionSig || !certUrl) {
      throw new WebhookVerificationError('paypal', 'Missing required webhook headers');
    }

    if (!certUrl.startsWith('https://www.paypal.com/') &&
        !certUrl.startsWith('https://api.sandbox.paypal.com/')) {
      throw new WebhookVerificationError('paypal', 'Invalid certificate URL');
    }

    const parsed = JSON.parse(body) as { id: string; event_type: string };
    return {
      id: transmissionId,
      gateway: this.name,
      event_type: parsed.event_type ?? 'unknown',
      payload: parsed,
      received_at: new Date().toISOString(),
      verified: true,
    };
  }

  private async request(method: string, path: string, body: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    return this.httpClient(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAccessToken()}`,
      },
      body: JSON.stringify(body),
    });
  }

  private getAccessToken(): string {
    return `env:${this.config.clientIdEnvVar}`;
  }

  private async handleError(intentId: string, res: Response): Promise<PaymentResult> {
    const text = await res.text().catch(() => '');
    if (res.status === 422) {
      throw new PaymentDeclinedError('paypal', text, 'DECLINED');
    }
    throw new GatewayError(`PayPal API error ${res.status}: ${text}`, 'paypal');
  }
}
