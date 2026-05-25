/**
 * Payment module type definitions
 */

export interface PaymentConfig {
  apiKey: string;
  storeId: string;
  webhookSecret?: string;
}

export interface CheckoutSession {
  checkoutId: string;
  checkoutUrl: string;
  planId: string;
  userId: string;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanType;
  status: 'active' | 'cancelled' | 'expired';
  variantId: string;
  orderId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PlanType = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanType;
  name: string;
  price: number;
  currency: string;
  features: string[];
  variantId: string;
}

export interface WebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, unknown>;
  };
  data: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
  };
}

export interface PaymentProvider {
  checkout(planId: string, userId: string): Promise<CheckoutSession>;
  handleWebhook(signature: string, body: string): Promise<WebhookEvent>;
}
