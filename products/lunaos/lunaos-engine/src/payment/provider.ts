/**
 * Payment provider factory for Luna-OS
 * Supports LemonSqueezy payment processing
 */

import { PaymentConfig, PaymentProvider, CheckoutSession, WebhookEvent } from './types';
import { verifyWebhookSignature } from './webhook';

export class LemonSqueezyProvider implements PaymentProvider {
  private apiKey: string;
  private storeId: string;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(config: PaymentConfig) {
    if (!config.apiKey) throw new Error('LemonSqueezy API key required');
    if (!config.storeId) throw new Error('LemonSqueezy store ID required');
    this.apiKey = config.apiKey;
    this.storeId = config.storeId;
  }

  async checkout(planId: string, userId: string): Promise<CheckoutSession> {
    const variantId = this.getVariantId(planId);
    if (!variantId) throw new Error(`Invalid plan: ${planId}`);

    const response = await fetch(
      `${this.baseUrl}/checkouts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                custom: { userId },
              },
            },
            relationships: {
              store: { data: { type: 'stores', id: this.storeId } },
              variant: { data: { type: 'variants', id: variantId } },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Checkout creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const baseUrl = data.data.attributes.urls.checkout;
    return {
      checkoutId: data.data.id,
      checkoutUrl: `${baseUrl}?embed=1`,
      planId,
      userId,
      createdAt: new Date(),
    };
  }

  async handleWebhook(
    signature: string,
    body: string
  ): Promise<WebhookEvent> {
    const isValid = await verifyWebhookSignature(signature, body);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(body) as WebhookEvent;
    return event;
  }

  private getVariantId(planId: string): string | null {
    const variantMap: Record<string, string> = {
      free: process.env.LEMONSQUEEZY_VARIANT_FREE || '1',
      pro: process.env.LEMONSQUEEZY_VARIANT_PRO || '2',
      team: process.env.LEMONSQUEEZY_VARIANT_TEAM || '3',
    };
    return variantMap[planId] || null;
  }
}

export function createPaymentProvider(
  type: 'lemonsqueezy',
  config: PaymentConfig
): PaymentProvider {
  if (type === 'lemonsqueezy') {
    return new LemonSqueezyProvider(config);
  }
  throw new Error(`Unknown payment provider: ${type}`);
}
