import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface LemonSqueezyProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface LemonSqueezyCheckout {
  id: string;
  url: string;
  expires_at: string;
}

export interface LemonSqueezySubscription {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  current_period_start: Date;
  current_period_end: Date;
  trial_end?: Date;
  cancel_at_period_end: boolean;
  customer_email: string;
  customer_name: string;
}

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, any>;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, any>;
    relationships?: Record<string, any>;
  };
}

export class LemonSqueezyService extends EventEmitter {
  private apiKey: string;
  private storeId: string;
  private baseURL = 'https://api.lemonsqueezy.com/v1';
  private webhookSecret: string;

  constructor() {
    super();
    this.apiKey = process.env.LEMONSQUEEZY_API_KEY || '';
    this.storeId = process.env.LEMONSQUEEZY_STORE_ID || '';
    this.webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';

    if (!this.apiKey || !this.storeId) {
      logger.warn('LemonSqueezy API key or store ID not configured');
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    };
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckout(options: {
    variantId: string;
    userId: string;
    userEmail: string;
    userName?: string;
    successUrl?: string;
    cancelUrl?: string;
    customData?: Record<string, any>;
  }): Promise<LemonSqueezyCheckout> {
    try {
      const checkoutData = {
        data: {
          type: 'checkouts',
          attributes: {
            product_options: {
              enabled_variants: [options.variantId]
            },
            checkout_options: {
              embed: false,
              media: true,
              logo: true
            },
            checkout_data: {
              email: options.userEmail,
              name: options.userName || '',
              custom: {
                user_id: options.userId,
                ...options.customData
              }
            },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            preview: false
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: this.storeId
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: options.variantId
              }
            }
          }
        }
      };

      // Add redirect URLs if provided
      if (options.successUrl || options.cancelUrl) {
        checkoutData.data.attributes.checkout_options = {
          ...checkoutData.data.attributes.checkout_options,
          ...(options.successUrl && { success_url: options.successUrl }),
          ...(options.cancelUrl && { cancel_url: options.cancelUrl })
        } as any;
      }

      const response = await axios.post(
        `${this.baseURL}/checkouts`,
        checkoutData,
        { headers: this.headers }
      );

      const checkout = response.data.data;

      logger.info(`Created LemonSqueezy checkout ${checkout.id} for user ${options.userId}`);

      return {
        id: checkout.id,
        url: checkout.attributes.url,
        expires_at: checkout.attributes.expires_at
      };
    } catch (error) {
      logger.error('Failed to create LemonSqueezy checkout:', error);
      throw new Error(`Checkout creation failed: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<LemonSqueezySubscription | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/subscriptions/${subscriptionId}`,
        { headers: this.headers }
      );

      const subscription = response.data.data;

      return this.formatSubscription(subscription);
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get LemonSqueezy subscription:', error);
      throw error;
    }
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerEmail: string): Promise<LemonSqueezySubscription[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/subscriptions?filter[user_email]=${customerEmail}`,
        { headers: this.headers }
      );

      return response.data.data.map((sub: any) => this.formatSubscription(sub));
    } catch (error) {
      logger.error('Failed to get customer subscriptions:', error);
      return [];
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<boolean> {
    try {
      const response = await axios.patch(
        `${this.baseURL}/subscriptions/${subscriptionId}`,
        {
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: {
              cancelled: !cancelAtPeriodEnd, // Immediate cancellation if false
              cancel_at_period_end: cancelAtPeriodEnd
            }
          }
        },
        { headers: this.headers }
      );

      logger.info(`Cancelled LemonSqueezy subscription ${subscriptionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Update subscription (pause/resume)
   */
  async updateSubscription(subscriptionId: string, updates: {
    paused?: boolean;
    cancel_at_period_end?: boolean;
  }): Promise<boolean> {
    try {
      const response = await axios.patch(
        `${this.baseURL}/subscriptions/${subscriptionId}`,
        {
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: updates
          }
        },
        { headers: this.headers }
      );

      logger.info(`Updated LemonSqueezy subscription ${subscriptionId}:`, updates);
      return true;
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      return false;
    }
  }

  /**
   * Get store products/variants for pricing display
   */
  async getProducts(): Promise<LemonSqueezyProduct[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/variants?filter[store_id]=${this.storeId}`,
        { headers: this.headers }
      );

      return response.data.data.map((variant: any) => ({
        id: variant.id,
        name: variant.attributes.name,
        price: variant.attributes.price,
        currency: variant.attributes.currency,
        interval: variant.attributes.interval,
        features: variant.attributes.description?.split('\n') || []
      }));
    } catch (error) {
      logger.error('Failed to get LemonSqueezy products:', error);
      return [];
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: LemonSqueezyWebhookEvent): Promise<void> {
    try {
      const { event_name } = event.meta;
      const { id, type, attributes } = event.data;

      logger.info(`Processing LemonSqueezy webhook: ${event_name}`, { id, type });

      switch (event_name) {
        case 'subscription_created':
          await this.handleSubscriptionCreated(event);
          break;

        case 'subscription_updated':
          await this.handleSubscriptionUpdated(event);
          break;

        case 'subscription_cancelled':
          await this.handleSubscriptionCancelled(event);
          break;

        case 'subscription_resumed':
          await this.handleSubscriptionResumed(event);
          break;

        case 'subscription_expired':
          await this.handleSubscriptionExpired(event);
          break;

        case 'subscription_paused':
          await this.handleSubscriptionPaused(event);
          break;

        case 'subscription_unpaused':
          await this.handleSubscriptionUnpaused(event);
          break;

        case 'subscription_payment_success':
          await this.handlePaymentSuccess(event);
          break;

        case 'subscription_payment_failed':
          await this.handlePaymentFailed(event);
          break;

        case 'subscription_payment_recovered':
          await this.handlePaymentRecovered(event);
          break;

        default:
          logger.warn(`Unhandled LemonSqueezy webhook event: ${event_name}`);
      }
    } catch (error) {
      logger.error('Error handling LemonSqueezy webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:created', subscription);
  }

  private async handleSubscriptionUpdated(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:updated', subscription);
  }

  private async handleSubscriptionCancelled(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:cancelled', subscription);
  }

  private async handleSubscriptionResumed(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:resumed', subscription);
  }

  private async handleSubscriptionExpired(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:expired', subscription);
  }

  private async handleSubscriptionPaused(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:paused', subscription);
  }

  private async handleSubscriptionUnpaused(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = this.formatSubscription(event.data);
    this.emit('subscription:unpaused', subscription);
  }

  private async handlePaymentSuccess(event: LemonSqueezyWebhookEvent): Promise<void> {
    this.emit('payment:success', event.data);
  }

  private async handlePaymentFailed(event: LemonSqueezyWebhookEvent): Promise<void> {
    this.emit('payment:failed', event.data);
  }

  private async handlePaymentRecovered(event: LemonSqueezyWebhookEvent): Promise<void> {
    this.emit('payment:recovered', event.data);
  }

  private formatSubscription(data: any): LemonSqueezySubscription {
    const attrs = data.attributes;

    return {
      id: data.id,
      user_id: attrs.custom_data?.user_id || attrs.user_email,
      product_id: attrs.product_id.toString(),
      variant_id: attrs.variant_id.toString(),
      status: attrs.status,
      current_period_start: new Date(attrs.current_period_start),
      current_period_end: new Date(attrs.current_period_end),
      trial_end: attrs.trial_ends_at ? new Date(attrs.trial_ends_at) : undefined,
      cancel_at_period_end: attrs.ends_at !== null,
      customer_email: attrs.user_email,
      customer_name: attrs.user_name || ''
    };
  }

  /**
   * Get customer portal URL for subscription management
   */
  async getCustomerPortalUrl(subscriptionId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/subscriptions/${subscriptionId}`,
        { headers: this.headers }
      );

      return response.data.data.attributes.urls?.customer_portal || null;
    } catch (error) {
      logger.error('Failed to get customer portal URL:', error);
      return null;
    }
  }
}

export const lemonSqueezyService = new LemonSqueezyService();