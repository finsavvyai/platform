import Stripe from 'stripe';
import { UserSubscription, Customer, Invoice, PaymentMethod, SubscriptionChangeRequest } from '../types/subscription.js';
import { getPlanById, getPlanByStripePrice } from '../config/subscriptionPlans.js';
import { logger } from '../utils/logger.js';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('STRIPE_SECRET_KEY environment variable is required in production');
      }
      // In development, use a dummy key
      logger.warn('STRIPE_SECRET_KEY not set, using development mode (payments disabled)');
    }

    const stripeConfig: Stripe.StripeConfig = {
      apiVersion: '2023-10-16',
      typescript: true,
    };

    // Support for WireMock in development
    if (process.env.STRIPE_API_BASE) {
      const url = new URL(process.env.STRIPE_API_BASE);
      stripeConfig.host = url.hostname;
      stripeConfig.port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
      stripeConfig.protocol = url.protocol.replace(':', '') as 'http' | 'https';
    }

    this.stripe = new Stripe(stripeKey || 'sk_test_dummy_key_for_development', stripeConfig);
  }

  // Customer Management
  async createCustomer(email: string, name?: string, metadata?: any): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          ...metadata,
          created_by: 'questro',
        },
      });

      logger.info(`Created Stripe customer: ${customer.id} for ${email}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to create Stripe customer: ${error}`);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  async updateCustomer(customerId: string, data: Partial<Stripe.CustomerUpdateParams>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, data);
      logger.info(`Updated Stripe customer: ${customerId}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to update Stripe customer: ${error}`);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
      return customer;
    } catch (error) {
      logger.error(`Failed to retrieve Stripe customer: ${error}`);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  }

  // Payment Methods
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      logger.info(`Attached payment method ${paymentMethodId} to customer ${customerId}`);
      return paymentMethod;
    } catch (error) {
      logger.error(`Failed to attach payment method: ${error}`);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info(`Set default payment method ${paymentMethodId} for customer ${customerId}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to set default payment method: ${error}`);
      throw new Error(`Failed to set default payment method: ${error.message}`);
    }
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error(`Failed to list payment methods: ${error}`);
      throw new Error(`Failed to list payment methods: ${error.message}`);
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      logger.info(`Detached payment method: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error(`Failed to detach payment method: ${error}`);
      throw new Error(`Failed to detach payment method: ${error.message}`);
    }
  }

  // Subscription Management
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
    trialDays?: number,
    couponCode?: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          created_by: 'questro',
        },
      };

      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      if (trialDays && trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }

      if (couponCode) {
        subscriptionData.coupon = couponCode;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      logger.info(`Created subscription ${subscription.id} for customer ${customerId}`);
      return subscription;
    } catch (error) {
      logger.error(`Failed to create subscription: ${error}`);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  async updateSubscription(subscriptionId: string, priceId: string, prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'): Promise<Stripe.Subscription> {
    try {
      // Get current subscription
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
        proration_behavior: prorationBehavior,
      });

      logger.info(`Updated subscription ${subscriptionId} to price ${priceId}`);
      return updatedSubscription;
    } catch (error) {
      logger.error(`Failed to update subscription: ${error}`);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      logger.info(`${cancelAtPeriodEnd ? 'Scheduled cancellation' : 'Immediately canceled'} subscription ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error(`Failed to cancel subscription: ${error}`);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      logger.info(`Reactivated subscription ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error(`Failed to reactivate subscription: ${error}`);
      throw new Error(`Failed to reactivate subscription: ${error.message}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'latest_invoice'],
      });

      return subscription;
    } catch (error) {
      logger.error(`Failed to retrieve subscription: ${error}`);
      throw new Error(`Failed to retrieve subscription: ${error.message}`);
    }
  }

  // Invoice Management
  async createInvoice(customerId: string, autoAdvance: boolean = true): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        auto_advance: autoAdvance,
      });

      logger.info(`Created invoice ${invoice.id} for customer ${customerId}`);
      return invoice;
    } catch (error) {
      logger.error(`Failed to create invoice: ${error}`);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (error) {
      logger.error(`Failed to retrieve invoice: ${error}`);
      throw new Error(`Failed to retrieve invoice: ${error.message}`);
    }
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data;
    } catch (error) {
      logger.error(`Failed to list invoices: ${error}`);
      throw new Error(`Failed to list invoices: ${error.message}`);
    }
  }

  // Coupons and Discounts
  async validateCoupon(couponCode: string): Promise<Stripe.Coupon | null> {
    try {
      const coupon = await this.stripe.coupons.retrieve(couponCode);

      // Check if coupon is valid
      if (!coupon.valid) {
        return null;
      }

      // Check expiration
      if (coupon.redeem_by && coupon.redeem_by < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // Check max redemptions
      if (coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions) {
        return null;
      }

      return coupon;
    } catch (error) {
      logger.warn(`Coupon validation failed: ${error.message}`);
      return null;
    }
  }

  // Setup Intents for payment method collection
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      logger.info(`Created setup intent ${setupIntent.id} for customer ${customerId}`);
      return setupIntent;
    } catch (error) {
      logger.error(`Failed to create setup intent: ${error}`);
      throw new Error(`Failed to create setup intent: ${error.message}`);
    }
  }

  // Billing Portal
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      logger.info(`Created billing portal session for customer ${customerId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to create billing portal session: ${error}`);
      throw new Error(`Failed to create billing portal session: ${error.message}`);
    }
  }

  // Checkout Sessions
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    trialDays?: number,
    couponCode?: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      const sessionData: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        tax_id_collection: {
          enabled: true,
        },
        metadata: {
          created_by: 'questro',
        },
      };

      if (trialDays && trialDays > 0) {
        sessionData.subscription_data = {
          trial_period_days: trialDays,
        };
      }

      if (couponCode) {
        sessionData.discounts = [{
          coupon: couponCode,
        }];
      }

      const session = await this.stripe.checkout.sessions.create(sessionData);

      logger.info(`Created checkout session ${session.id} for customer ${customerId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to create checkout session: ${error}`);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  async getCheckoutSession(sessionId: string, options?: { expand?: string[] }): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, options);
      return session;
    } catch (error) {
      logger.error(`Failed to retrieve checkout session: ${error}`);
      throw new Error(`Failed to retrieve checkout session: ${error.message}`);
    }
  }

  // Usage Records (for metered billing if needed)
  async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<Stripe.UsageRecord> {
    try {
      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'set',
      });

      logger.info(`Created usage record for subscription item ${subscriptionItemId}: ${quantity}`);
      return usageRecord;
    } catch (error) {
      logger.error(`Failed to create usage record: ${error}`);
      throw new Error(`Failed to create usage record: ${error.message}`);
    }
  }

  // Webhook signature verification
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error(`Webhook signature verification failed: ${error}`);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  // Utility methods
  formatAmount(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }

  isSubscriptionActive(subscription: Stripe.Subscription): boolean {
    return ['active', 'trialing'].includes(subscription.status);
  }

  isSubscriptionPastDue(subscription: Stripe.Subscription): boolean {
    return subscription.status === 'past_due';
  }

  isSubscriptionCanceled(subscription: Stripe.Subscription): boolean {
    return ['canceled', 'unpaid'].includes(subscription.status);
  }
}

export const stripeService = new StripeService();