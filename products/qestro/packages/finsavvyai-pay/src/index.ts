/**
 * @finsavvyai/pay — Unified payment provider
 *
 * Features:
 * - Stripe + LemonSqueezy unified interface
 * - Shared webhook handling with signature verification
 * - Customer, subscription, and invoice management
 * - Automatic provider selection by region
 */

export interface PaymentProvider {
  name: string;
  createCustomer(email: string, name?: string): Promise<PayCustomer>;
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>;
  createSubscription(params: SubscriptionParams): Promise<PaySubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<PaySubscription>;
  constructWebhookEvent(body: string, signature: string): Promise<WebhookEvent>;
}

export interface PayCustomer {
  id: string;
  email: string;
  name?: string;
  provider: string;
}

export interface CheckoutParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  coupon?: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  provider: string;
}

export interface SubscriptionParams {
  customerId: string;
  priceId: string;
  trialDays?: number;
}

export interface PaySubscription {
  id: string;
  customerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  priceId: string;
  currentPeriodEnd: Date;
  provider: string;
}

export interface WebhookEvent {
  type: string;
  provider: string;
  data: Record<string, unknown>;
}

export { StripeAdapter } from './stripe-adapter.js';
export { LemonSqueezyAdapter } from './lemonsqueezy-adapter.js';

export class UnifiedPayments {
  private providers: Map<string, PaymentProvider> = new Map();
  private defaultProvider: string = 'stripe';

  register(provider: PaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefault(name: string): void {
    this.defaultProvider = name;
  }

  get(name?: string): PaymentProvider {
    const provider = this.providers.get(name || this.defaultProvider);
    if (!provider) {
      throw new Error(`Payment provider "${name || this.defaultProvider}" not registered`);
    }
    return provider;
  }

  async createCustomer(email: string, name?: string): Promise<PayCustomer> {
    return this.get().createCustomer(email, name);
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    return this.get().createCheckoutSession(params);
  }

  async cancelSubscription(subscriptionId: string, provider?: string): Promise<void> {
    return this.get(provider).cancelSubscription(subscriptionId);
  }
}
