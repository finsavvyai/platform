import {
  PaymentProvider,
  CheckoutOptions,
  CheckoutSession,
  Subscription,
  WebhookEvent,
  PaymentError,
} from '../types.js';
import { WebhookHandler } from '../webhook/handler.js';

export class StripeClient implements PaymentProvider {
  readonly name = 'stripe';
  private baseUrl = 'https://api.stripe.com/v1';
  private webhookHandler: WebhookHandler;

  constructor(
    private apiKey: string,
    private webhookSecret: string,
  ) {
    this.webhookHandler = new WebhookHandler({
      provider: 'stripe',
      secret: webhookSecret,
    });
  }

  async createCheckout(opts: CheckoutOptions): Promise<CheckoutSession> {
    try {
      const body = new URLSearchParams({
        'payment_method_types[]': 'card',
        'customer': opts.customerId,
        'line_items[0][price]': opts.priceId,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'success_url': opts.successUrl,
        'cancel_url': opts.cancelUrl,
      });

      const response = await fetch(`${this.baseUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new PaymentError('CHECKOUT_FAILED', 'stripe', `Stripe API error: ${response.statusText}`);
      }

      const session = (await response.json()) as Record<string, unknown>;

      return {
        id: session.id as string,
        url: session.url as string,
        customerId: opts.customerId,
        priceId: opts.priceId,
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('CHECKOUT_FAILED', 'stripe', `Failed to create checkout: ${error}`);
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
        throw new PaymentError('SUBSCRIPTION_NOT_FOUND', 'stripe', `Subscription not found: ${subscriptionId}`);
      }

      const sub = (await response.json()) as Record<string, unknown>;

      return {
        id: sub.id as string,
        customerId: sub.customer as string,
        plan: String((sub.items as Record<string, unknown>)?.data?.[0]?.price?.id || ''),
        status: (sub.status as string) as Subscription['status'],
        currentPeriodEnd: new Date((sub.current_period_end as number) * 1000),
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('SUBSCRIPTION_FAILED', 'stripe', `Failed to fetch subscription: ${error}`);
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
        throw new PaymentError('CANCEL_FAILED', 'stripe', `Failed to cancel subscription: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('CANCEL_FAILED', 'stripe', `Failed to cancel subscription: ${error}`);
    }
  }

  async handleWebhook(signature: string, body: string): Promise<WebhookEvent> {
    return this.webhookHandler.handle(signature, body);
  }
}
