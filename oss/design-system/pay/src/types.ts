export interface PaymentProvider {
  name: string;
  createCheckout(opts: CheckoutOptions): Promise<CheckoutSession>;
  getSubscription(subscriptionId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  handleWebhook(signature: string, body: string): Promise<WebhookEvent>;
}

export interface CheckoutOptions {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  customerId: string;
  priceId: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodEnd: Date;
}

export interface WebhookEvent {
  type:
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.cancelled'
    | 'payment.succeeded'
    | 'payment.failed';
  data: Record<string, unknown>;
}

export class PaymentError extends Error {
  constructor(
    public code: string,
    public provider: string,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}
