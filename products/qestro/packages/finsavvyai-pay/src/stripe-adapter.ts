/**
 * Stripe adapter for @finsavvyai/pay
 */

import Stripe from 'stripe';
import type {
  PaymentProvider,
  PayCustomer,
  CheckoutParams,
  CheckoutSession,
  SubscriptionParams,
  PaySubscription,
  WebhookEvent,
} from './index.js';

export class StripeAdapter implements PaymentProvider {
  readonly name = 'stripe';
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
    this.webhookSecret = webhookSecret || '';
  }

  async createCustomer(email: string, name?: string): Promise<PayCustomer> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { created_by: 'finsavvyai' },
    });
    return { id: customer.id, email, name, provider: 'stripe' };
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
    };

    if (params.trialDays) {
      sessionParams.subscription_data = {
        trial_period_days: params.trialDays,
      };
    }

    if (params.coupon) {
      sessionParams.discounts = [{ coupon: params.coupon }];
      delete sessionParams.allow_promotion_codes;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    return { id: session.id, url: session.url || '', provider: 'stripe' };
  }

  async createSubscription(params: SubscriptionParams): Promise<PaySubscription> {
    const subParams: Stripe.SubscriptionCreateParams = {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    };

    if (params.trialDays) {
      subParams.trial_period_days = params.trialDays;
    }

    const sub = await this.stripe.subscriptions.create(subParams);
    return this.mapSubscription(sub);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async getSubscription(subscriptionId: string): Promise<PaySubscription> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    return this.mapSubscription(sub);
  }

  async constructWebhookEvent(
    body: string,
    signature: string,
  ): Promise<WebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      this.webhookSecret,
    );
    return {
      type: event.type,
      provider: 'stripe',
      data: event.data.object as unknown as Record<string, unknown>,
    };
  }

  private mapSubscription(sub: Stripe.Subscription): PaySubscription {
    return {
      id: sub.id,
      customerId: sub.customer as string,
      status: sub.status as PaySubscription['status'],
      priceId: sub.items.data[0]?.price.id || '',
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      provider: 'stripe',
    };
  }
}
