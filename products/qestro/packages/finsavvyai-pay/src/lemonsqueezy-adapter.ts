/**
 * LemonSqueezy adapter for @finsavvyai/pay
 * Enables international payments where Stripe coverage is limited
 */

import type {
  PaymentProvider,
  PayCustomer,
  CheckoutParams,
  CheckoutSession,
  SubscriptionParams,
  PaySubscription,
  WebhookEvent,
} from './index.js';

const LS_API = 'https://api.lemonsqueezy.com/v1';

export class LemonSqueezyAdapter implements PaymentProvider {
  readonly name = 'lemonsqueezy';
  private apiKey: string;
  private storeId: string;
  private webhookSecret: string;

  constructor(apiKey: string, storeId: string, webhookSecret?: string) {
    this.apiKey = apiKey;
    this.storeId = storeId;
    this.webhookSecret = webhookSecret || '';
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${LS_API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`LemonSqueezy API error: ${response.status}`);
    }
    return response.json();
  }

  async createCustomer(email: string, name?: string): Promise<PayCustomer> {
    const result = await this.request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'customers',
          attributes: { email, name: name || email },
          relationships: {
            store: { data: { type: 'stores', id: this.storeId } },
          },
        },
      }),
    });
    return {
      id: result.data.id,
      email,
      name,
      provider: 'lemonsqueezy',
    };
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const result = await this.request('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: params.customerId,
              custom: { customer_id: params.customerId },
            },
            product_options: { redirect_url: params.successUrl },
          },
          relationships: {
            store: { data: { type: 'stores', id: this.storeId } },
            variant: { data: { type: 'variants', id: params.priceId } },
          },
        },
      }),
    });
    return {
      id: result.data.id,
      url: result.data.attributes.url,
      provider: 'lemonsqueezy',
    };
  }

  async createSubscription(_params: SubscriptionParams): Promise<PaySubscription> {
    throw new Error('LemonSqueezy subscriptions are created via checkout');
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  async getSubscription(subscriptionId: string): Promise<PaySubscription> {
    const result = await this.request(`/subscriptions/${subscriptionId}`);
    const attrs = result.data.attributes;
    return {
      id: result.data.id,
      customerId: attrs.customer_id?.toString() || '',
      status: this.mapStatus(attrs.status),
      priceId: attrs.variant_id?.toString() || '',
      currentPeriodEnd: new Date(attrs.renews_at),
      provider: 'lemonsqueezy',
    };
  }

  async constructWebhookEvent(
    body: string,
    signature: string,
  ): Promise<WebhookEvent> {
    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSig !== signature) {
      throw new Error('Invalid webhook signature');
    }

    const payload = JSON.parse(body);
    return {
      type: payload.meta?.event_name || 'unknown',
      provider: 'lemonsqueezy',
      data: payload.data?.attributes || {},
    };
  }

  private mapStatus(lsStatus: string): PaySubscription['status'] {
    const map: Record<string, PaySubscription['status']> = {
      active: 'active',
      cancelled: 'canceled',
      past_due: 'past_due',
      on_trial: 'trialing',
      unpaid: 'incomplete',
    };
    return map[lsStatus] || 'incomplete';
  }
}
