import {
  PaymentProvider,
  CheckoutOptions,
  CheckoutSession,
  Subscription,
  WebhookEvent,
  PaymentError,
} from '../types.js';
import { WebhookHandler } from '../webhook/handler.js';

export class LemonSqueezyClient implements PaymentProvider {
  readonly name = 'lemonsqueezy';
  private baseUrl = 'https://api.lemonsqueezy.com/v1';
  private webhookHandler: WebhookHandler;

  constructor(
    private apiKey: string,
    private webhookSecret: string,
  ) {
    this.webhookHandler = new WebhookHandler({
      provider: 'lemonsqueezy',
      secret: webhookSecret,
    });
  }

  async createCheckout(opts: CheckoutOptions): Promise<CheckoutSession> {
    try {
      const response = await fetch(`${this.baseUrl}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              product_id: opts.priceId,
              custom: {
                customer_id: opts.customerId,
              },
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: this.extractStoreId(opts.priceId),
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new PaymentError('CHECKOUT_FAILED', 'lemonsqueezy', `LemonSqueezy API error: ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const checkout = (data.data as Record<string, unknown>) || {};

      return {
        id: checkout.id as string,
        url: (checkout.attributes as Record<string, unknown>)?.checkout_data?.checkout_url as string,
        customerId: opts.customerId,
        priceId: opts.priceId,
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('CHECKOUT_FAILED', 'lemonsqueezy', `Failed to create checkout: ${error}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new PaymentError('SUBSCRIPTION_NOT_FOUND', 'lemonsqueezy', `Subscription not found: ${subscriptionId}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const sub = (data.data as Record<string, unknown>) || {};
      const attrs = (sub.attributes as Record<string, unknown>) || {};

      return {
        id: sub.id as string,
        customerId: attrs.customer_id as string,
        plan: attrs.variant_id as string,
        status: (attrs.status as string) as Subscription['status'],
        currentPeriodEnd: new Date(attrs.renews_at as string),
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('SUBSCRIPTION_FAILED', 'lemonsqueezy', `Failed to fetch subscription: ${error}`);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new PaymentError('CANCEL_FAILED', 'lemonsqueezy', `Failed to cancel subscription: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('CANCEL_FAILED', 'lemonsqueezy', `Failed to cancel subscription: ${error}`);
    }
  }

  async handleWebhook(signature: string, body: string): Promise<WebhookEvent> {
    return this.webhookHandler.handle(signature, body);
  }

  private extractStoreId(priceId: string): string {
    const parts = priceId.split('_');
    return parts[0] || '1';
  }
}
