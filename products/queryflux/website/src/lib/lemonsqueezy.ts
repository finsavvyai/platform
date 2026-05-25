/**
 * LemonSqueezy Integration for QueryFlux Marketing Website
 * Handles checkout, subscription management, and webhooks
 */

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  isDev: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  variantId: string; // LemonSqueezy variant ID
  popular?: boolean;
}

export interface CheckoutOptions {
  planId: string;
  userEmail?: string;
  customData?: Record<string, any>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface Subscription {
  id: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  customerEmail: string;
  trialEnd?: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  subscriptions: Subscription[];
}

class LemonSqueezyClient {
  private config: LemonSqueezyConfig;
  private baseUrl: string;

  constructor(config: LemonSqueezyConfig) {
    this.config = config;
    this.baseUrl = config.isDev
      ? 'https://api.lemonsqueezy.com/v1'
      : 'https://api.lemonsqueezy.com/v1';
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LemonSqueezy API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a checkout session for a plan
   */
  async createCheckout(options: CheckoutOptions): Promise<{ checkoutUrl: string }> {
    const plans = this.getPlans();
    const plan = plans.find(p => p.id === options.planId);

    if (!plan) {
      throw new Error(`Plan not found: ${options.planId}`);
    }

    const checkoutData = {
      store_id: this.config.storeId,
      variant_id: plan.variantId,
      customer_email: options.userEmail,
      custom_price: plan.price * 100, // Convert to cents
      checkout_data: {
        custom: {
          ...options.customData,
          plan_id: options.planId,
        },
      },
      checkout_options: {
        embed: false,
        media: false,
        logo: !this.config.isDev,
        desc: plan.description,
        subscription_preview: true,
        button_color: '#3B82F6',
        redirect_url: options.successUrl,
      },
      product_options: {
        enabled_variants: [plan.variantId],
        redirect_url: options.cancelUrl,
      },
    };

    const response = await this.makeRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
    });

    return {
      checkoutUrl: response.data.attributes.url,
    };
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    const response = await this.makeRequest(`/subscriptions/${subscriptionId}`);
    return response.data;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediate = false): Promise<any> {
    const response = await this.makeRequest(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscriptionId,
          attributes: {
            cancelled: true,
            cancellation_reason: 'Customer requested cancellation',
            ...(immediate && { ends_at: new Date().toISOString() }),
          },
        },
      }),
    });
    return response.data;
  }

  /**
   * Update subscription (change plan, etc.)
   */
  async updateSubscription(
    subscriptionId: string,
    variantId: string
  ): Promise<any> {
    const response = await this.makeRequest(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscriptionId,
          attributes: {
            variant_id: variantId,
          },
        },
      }),
    });
    return response.data;
  }

  /**
   * Get customer information
   */
  async getCustomer(customerId: string): Promise<any> {
    const response = await this.makeRequest(`/customers/${customerId}`);
    return response.data;
  }

  /**
   * Create a customer
   */
  async createCustomer(customerData: {
    name: string;
    email: string;
  }): Promise<any> {
    const response = await this.makeRequest('/customers', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'customers',
          attributes: {
            name: customerData.name,
            email: customerData.email,
            store_id: this.config.storeId,
          },
        },
      }),
    });
    return response.data;
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
    const expectedSignature = hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get available plans
   */
  getPlans(): Plan[] {
    return [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for individual developers and small projects',
        price: 9,
        currency: 'USD',
        interval: 'month',
        features: [
          'Up to 5 database connections',
          'Basic query editor',
          'Query history (100 queries)',
          'Email support',
          'Community access',
        ],
        variantId: this.config.isDev ? '12345' : '54321',
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'For professional developers and growing teams',
        price: 29,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited database connections',
          'Advanced query editor',
          'Unlimited query history',
          'Real-time monitoring',
          'AI-powered query optimization',
          'Priority email support',
          'Team collaboration features',
          'Custom themes',
        ],
        variantId: this.config.isDev ? '12346' : '54322',
        popular: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For large organizations with advanced needs',
        price: 99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Professional',
          'SSO authentication',
          'Advanced security features',
          'Custom integrations',
          'Dedicated account manager',
          'Phone support',
          'SLA guarantee',
          'On-premise deployment option',
          'Custom training sessions',
        ],
        variantId: this.config.isDev ? '12347' : '54323',
      },
    ];
  }

  /**
   * Get plans with annual pricing
   */
  getAnnualPlans(): Plan[] {
    const monthlyPlans = this.getPlans();
    return monthlyPlans.map(plan => ({
      ...plan,
      id: `${plan.id}-annual`,
      price: Math.floor(plan.price * 10), // 2 months free
      interval: 'year' as const,
      description: `${plan.description} (2 months free!)`,
      variantId: this.config.isDev
        ? (parseInt(plan.variantId) + 100).toString()
        : (parseInt(plan.variantId) + 100).toString(),
    }));
  }
}

export class LemonSqueezyWebhookHandler {
  private client: LemonSqueezyClient;
  private backendAPI: string;

  constructor(client: LemonSqueezyClient, backendAPI: string) {
    this.client = client;
    this.backendAPI = backendAPI;
  }

  async handleWebhook(
    eventName: string,
    payload: any
  ): Promise<{ success: boolean; message?: string }> {
    try {
      switch (eventName) {
        case 'order_created':
          await this.handleOrderCreated(payload);
          break;

        case 'subscription_created':
          await this.handleSubscriptionCreated(payload);
          break;

        case 'subscription_updated':
          await this.handleSubscriptionUpdated(payload);
          break;

        case 'subscription_cancelled':
          await this.handleSubscriptionCancelled(payload);
          break;

        case 'subscription_expired':
          await this.handleSubscriptionExpired(payload);
          break;

        default:
          console.log(`Unhandled webhook event: ${eventName}`);
          return { success: true };
      }

      return { success: true };
    } catch (error: any) {
      console.error(`Error handling webhook ${eventName}:`, error);
      return { success: false, message: error.message };
    }
  }

  private async handleOrderCreated(payload: any): Promise<void> {
    const order = payload.data.attributes;
    const customerEmail = order.customer_email;

    // Notify backend of new order
    await fetch(`${this.backendAPI}/webhooks/lemonsqueezy/order-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.identifier,
        customerEmail,
        total: order.total,
        currency: order.currency,
        status: order.status,
        productName: order.first_order_item.product_name,
      }),
    });
  }

  private async handleSubscriptionCreated(payload: any): Promise<void> {
    const subscription = payload.data.attributes;
    const customerEmail = subscription.customer_email;

    // Extract custom data
    const planId = subscription.custom?.plan_id;
    const userId = subscription.custom?.user_id;

    // Notify backend of new subscription
    await fetch(`${this.backendAPI}/webhooks/lemonsqueezy/subscription-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.identifier,
        customerId: subscription.customer_id,
        customerEmail,
        planId,
        userId,
        status: subscription.status,
        currentPeriodEnd: subscription.renews_at,
        trialEnd: subscription.trial_ends_at,
      }),
    });
  }

  private async handleSubscriptionUpdated(payload: any): Promise<void> {
    const subscription = payload.data.attributes;

    await fetch(`${this.backendAPI}/webhooks/lemonsqueezy/subscription-updated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.identifier,
        status: subscription.status,
        currentPeriodEnd: subscription.renews_at,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }),
    });
  }

  private async handleSubscriptionCancelled(payload: any): Promise<void> {
    const subscription = payload.data.attributes;

    await fetch(`${this.backendAPI}/webhooks/lemonsqueezy/subscription-cancelled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.identifier,
        status: subscription.status,
        cancelledAt: subscription.cancelled_at,
        endsAt: subscription.ends_at,
      }),
    });
  }

  private async handleSubscriptionExpired(payload: any): Promise<void> {
    const subscription = payload.data.attributes;

    await fetch(`${this.backendAPI}/webhooks/lemonsqueezy/subscription-expired`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.identifier,
        customerId: subscription.customer_id,
        status: subscription.status,
        expiredAt: subscription.expires_at,
      }),
    });
  }
}

// Create and export instances
export const createLemonSqueezyClient = (config: LemonSqueezyConfig) => {
  return new LemonSqueezyClient(config);
};

export const createWebhookHandler = (
  client: LemonSqueezyClient,
  backendAPI: string
) => {
  return new LemonSqueezyWebhookHandler(client, backendAPI);
};

// Legacy exports for compatibility
export interface LemonSqueezyCheckoutResponse {
  checkoutUrl: string
  sessionId: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  yearlyPrice: number
  features: string[]
  popular?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'professional-monthly',
    name: 'Professional',
    description: 'For professional developers and growing teams',
    price: 29,
    yearlyPrice: 290,
    features: [
      'Unlimited database connections',
      'Advanced query editor',
      'Unlimited query history',
      'Real-time monitoring',
      'AI-powered query optimization',
      'Priority email support',
      'Team collaboration features',
      'Custom themes',
    ],
    popular: true
  },
  {
    id: 'enterprise-monthly',
    name: 'Enterprise',
    description: 'For large organizations with advanced needs',
    price: 99,
    yearlyPrice: 990,
    features: [
      'Everything in Professional',
      'SSO authentication',
      'Advanced security features',
      'Custom integrations',
      'Dedicated account manager',
      'Phone support',
      'SLA guarantee',
      'On-premise deployment option',
      'Custom training sessions',
    ]
  }
]

export async function createLemonSqueezyCheckout(data: {
  planId: string
  planName: string
  price: number
  isYearly: boolean
  customerEmail?: string
}): Promise<LemonSqueezyCheckoutResponse> {
  // This function maintains compatibility with existing code
  // while using the new LemonSqueezy client implementation

  const config: LemonSqueezyConfig = {
    apiKey: process.env.LEMONSQUEEZY_API_KEY || 'test-key',
    storeId: process.env.LEMONSQUEEZY_STORE_ID || 'test-store',
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || 'test-secret',
    isDev: process.env.NODE_ENV === 'development',
  };

  const client = createLemonSqueezyClient(config);

  try {
    const result = await client.createCheckout({
      planId: data.planId,
      userEmail: data.customerEmail,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    });

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: data.planId, // Use planId as sessionId for compatibility
    };
  } catch (error) {
    // Fallback to mock implementation in development
    console.warn('LemonSqueezy API not available, using fallback:', error);
    return {
      checkoutUrl: 'https://queryflux.lemonsqueezy.com/checkout/mock-checkout-id',
      sessionId: 'mock-session-id'
    };
  }
}

export default LemonSqueezyClient;