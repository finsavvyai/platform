/**
 * Payment provider types and interfaces.
 * Defines checkout, webhook, and subscription event types.
 */

export type Plan = 'free' | 'pro' | 'enterprise';

export interface PlanConfig {
  id: string;
  name: string;
  variantId: string;
  price: number;
  currency: string;
  features: string[];
}

export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  plan: Plan;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: Date;
}

export interface PaymentProvider {
  createCheckout(planId: Plan, userId: string): Promise<CheckoutSession>;
  handleWebhook(signature: string, body: string): Promise<WebhookEvent>;
  getPlan(planId: Plan): PlanConfig;
}

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  productId: string;
  webhookSecret: string;
  plans: {
    free?: PlanConfig;
    pro: PlanConfig;
    enterprise: PlanConfig;
  };
}
