import Stripe from 'stripe';
import { PLAN_CONFIGS, CheckoutConfig, CheckoutSession, PortalSession, WebhookEvent, WebhookResult } from './types';

/**
 * StripeService: Production Stripe integration for billing
 * Handles customer creation, checkout sessions, subscriptions, and webhooks
 */

class StripeService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16'
    });

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createCustomer(email: string, name: string): Promise<string> {
    try {
      // Check if customer exists
      const existingCustomers = await this.stripe.customers.list({
        email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          createdAt: new Date().toISOString()
        }
      });

      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create Stripe customer');
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    config: CheckoutConfig
  ): Promise<CheckoutSession> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: config.customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: config.priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: config.successUrl,
        cancel_url: config.cancelUrl,
        client_reference_id: config.clientReferenceId,
        metadata: config.metadata || {}
      });

      if (!session.url) {
        throw new Error('No checkout URL returned');
      }

      return {
        id: session.id,
        url: session.url,
        customerId: config.customerId
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create a portal session for subscription management
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<PortalSession> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });

      return {
        url: session.url,
        stripeCustomerId: customerId
      };
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw new Error('Failed to create billing portal session');
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw new Error('Failed to retrieve subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Handle incoming webhook events
   */
  async handleWebhook(
    payload: Buffer,
    signature: string
  ): Promise<WebhookResult> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      ) as unknown as WebhookEvent;

      switch (event.type) {
        case 'checkout.session.completed':
          return this.handleCheckoutSessionCompleted(event);

        case 'customer.subscription.updated':
          return this.handleSubscriptionUpdated(event);

        case 'customer.subscription.deleted':
          return this.handleSubscriptionDeleted(event);

        case 'invoice.payment_succeeded':
          return this.handleInvoicePaymentSucceeded(event);

        case 'invoice.payment_failed':
          return this.handleInvoicePaymentFailed(event);

        default:
          return {
            success: true,
            message: 'Event received but not processed'
          };
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      return {
        success: false,
        message: 'Failed to process webhook'
      };
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private async handleCheckoutSessionCompleted(
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const session = event.data.object as any;

    return {
      success: true,
      message: 'Checkout completed',
      action: 'subscription_created',
      userId: session.client_reference_id
    };
  }

  /**
   * Handle customer.subscription.updated event
   */
  private async handleSubscriptionUpdated(
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const subscription = event.data.object as any;

    return {
      success: true,
      message: 'Subscription updated',
      action: 'subscription_updated',
      userId: subscription.metadata?.userId
    };
  }

  /**
   * Handle customer.subscription.deleted event
   */
  private async handleSubscriptionDeleted(
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const subscription = event.data.object as any;

    return {
      success: true,
      message: 'Subscription deleted',
      action: 'subscription_deleted',
      userId: subscription.metadata?.userId
    };
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  private async handleInvoicePaymentSucceeded(
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const invoice = event.data.object as any;

    return {
      success: true,
      message: 'Payment succeeded',
      action: 'payment_succeeded',
      userId: invoice.metadata?.userId
    };
  }

  /**
   * Handle invoice.payment_failed event
   */
  private async handleInvoicePaymentFailed(
    event: WebhookEvent
  ): Promise<WebhookResult> {
    const invoice = event.data.object as any;

    return {
      success: false,
      message: 'Payment failed',
      action: 'payment_failed',
      userId: invoice.metadata?.userId
    };
  }

  /**
   * List available plans with pricing
   */
  getAvailablePlans() {
    return Object.values(PLAN_CONFIGS);
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string) {
    return PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS];
  }
}

export default new StripeService();
