/**
 * Payment Service
 * Handles payment processing, subscription management, and billing
 * Integrates with Lemon Squeezy for payment processing
 */

import { logger } from '../utils/logger.js';
import { DatabaseService } from './DatabaseService.js';

// Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    tests: number;
    users: number;
    storage: number;
    apiCalls: number;
  };
  lemonSqueezyVariantId: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  lemonSqueezySubscriptionId: string;
  lemonSqueezyCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card';
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  lemonSqueezyPaymentMethodId: string;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: Date;
  paidAt?: Date;
  lemonSqueezyInvoiceId: string;
  invoiceUrl: string;
  createdAt: Date;
}

export interface UsageMetrics {
  userId: string;
  period: Date;
  tests: number;
  users: number;
  storage: number;
  apiCalls: number;
}

export class PaymentService {
  private db: DatabaseService;
  private lemonSqueezyApiKey: string;
  private webhookSecret: string;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.lemonSqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY!;
    this.webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  }

  /**
   * Get available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const plans: SubscriptionPlan[] = [
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for individuals and small projects',
          price: 29,
          currency: 'USD',
          interval: 'monthly',
          features: [
            '100 tests per month',
            '5 team members',
            '10GB storage',
            'Email support'
          ],
          limits: {
            tests: 100,
            users: 5,
            storage: 10 * 1024 * 1024 * 1024, // 10GB
            apiCalls: 10000
          },
          lemonSqueezyVariantId: process.env.LEMONSQUEEZY_VARIANT_ID_STARTER!
        },
        {
          id: 'professional',
          name: 'Professional',
          description: 'For growing teams and professional use',
          price: 99,
          currency: 'USD',
          interval: 'monthly',
          features: [
            'Unlimited tests',
            '20 team members',
            '100GB storage',
            'Priority email support',
            'Advanced analytics',
            'Custom integrations'
          ],
          limits: {
            tests: -1, // Unlimited
            users: 20,
            storage: 100 * 1024 * 1024 * 1024, // 100GB
            apiCalls: 100000
          },
          lemonSqueezyVariantId: process.env.LEMONSQUEEZY_VARIANT_ID_PRO!
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'For large organizations with advanced needs',
          price: 299,
          currency: 'USD',
          interval: 'monthly',
          features: [
            'Unlimited everything',
            'Unlimited team members',
            '1TB storage',
            'Dedicated support',
            'Custom features',
            'SLA guarantee',
            'On-premise option'
          ],
          limits: {
            tests: -1, // Unlimited
            users: -1, // Unlimited
            storage: 1024 * 1024 * 1024 * 1024, // 1TB
            apiCalls: -1 // Unlimited
          },
          lemonSqueezyVariantId: process.env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE!
        }
      ];

      return plans;
    } catch (error) {
      logger.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(userId: string, planId: string, successUrl: string, cancelUrl: string): Promise<{ checkoutUrl: string }> {
    try {
      const plans = await this.getPlans();
      const plan = plans.find(p => p.id === planId);

      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      // Get or create Lemon Squeezy customer
      const customer = await this.getOrCreateCustomer(userId);

      // Create checkout session
      const checkoutData = {
        data: {
          type: 'checkouts',
          attributes: {
            store_id: process.env.LEMONSQUEEZY_STORE_ID,
            customer_id: customer.lemonSqueezyCustomerId,
            variant_id: plan.lemonSqueezyVariantId,
            product_options: {
              redirect_url: successUrl,
              receipt_button_text: 'Go to Dashboard',
              receipt_thank_you_note: 'Thank you for subscribing to Questro!'
            }
          }
        }
      };

      const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${this.lemonSqueezyApiKey}`
        },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create checkout: ${response.statusText}`);
      }

      const data = await response.json();
      const checkoutUrl = (data as any).data.attributes.url;

      logger.info(`Created checkout session for user ${userId}, plan ${planId}`);

      return { checkoutUrl };
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get or create Lemon Squeezy customer
   */
  private async getOrCreateCustomer(userId: string) {
    try {
      // Check if customer already exists
      const existingCustomer = await this.db.query(
        'SELECT * FROM payment_customers WHERE user_id = $1',
        [userId]
      );

      if (existingCustomer.rows.length > 0) {
        return existingCustomer.rows[0];
      }

      // Get user details
      const user = await this.db.query(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const userData = user.rows[0];

      // Create Lemon Squeezy customer
      const customerData = {
        data: {
          type: 'customers',
          attributes: {
            store_id: process.env.LEMONSQUEEZY_STORE_ID,
            name: userData.name,
            email: userData.email
          }
        }
      };

      const response = await fetch('https://api.lemonsqueezy.com/v1/customers', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${this.lemonSqueezyApiKey}`
        },
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.statusText}`);
      }

      const data = await response.json();
      const lemonSqueezyCustomer = (data as any).data;

      // Store customer in database
      const newCustomer = await this.db.query(
        `INSERT INTO payment_customers (user_id, lemon_squeezy_customer_id, email, name, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [
          userId,
          lemonSqueezyCustomer.id,
          userData.email,
          userData.name
        ]
      );

      logger.info(`Created Lemon Squeezy customer for user ${userId}`);

      return newCustomer.rows[0];
    } catch (error) {
      logger.error('Error getting/creating customer:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events from Lemon Squeezy
   */
  async handleWebhook(event: string, data: any): Promise<void> {
    try {
      logger.info(`Processing webhook event: ${event}`);

      switch (event) {
        case 'subscription_created':
          await this.handleSubscriptionCreated(data);
          break;
        case 'subscription_updated':
          await this.handleSubscriptionUpdated(data);
          break;
        case 'subscription_cancelled':
          await this.handleSubscriptionCancelled(data);
          break;
        case 'subscription_expired':
          await this.handleSubscriptionExpired(data);
          break;
        case 'order_created':
          await this.handleOrderCreated(data);
          break;
        case 'payment_success':
          await this.handlePaymentSuccess(data);
          break;
        case 'payment_failed':
          await this.handlePaymentFailed(data);
          break;
        default:
          logger.warn(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      logger.error(`Error handling webhook event ${event}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription creation
   */
  private async handleSubscriptionCreated(data: any): Promise<void> {
    const subscription = data.data;
    const attributes = subscription.attributes;
    const customerId = attributes.customer_id;
    const variantId = attributes.variant_id;

    // Find user by Lemon Squeezy customer ID
    const customer = await this.db.query(
      'SELECT user_id FROM payment_customers WHERE lemon_squeezy_customer_id = $1',
      [customerId]
    );

    if (customer.rows.length === 0) {
      logger.error(`Customer not found for Lemon Squeezy ID: ${customerId}`);
      return;
    }

    const userId = customer.rows[0].user_id;

    // Find plan by variant ID
    const plans = await this.getPlans();
    const plan = plans.find(p => p.lemonSqueezyVariantId === variantId);

    if (!plan) {
      logger.error(`Plan not found for variant ID: ${variantId}`);
      return;
    }

    // Create subscription record
    await this.db.query(
      `INSERT INTO subscriptions (
        user_id, plan_id, status, current_period_start, current_period_end,
        cancel_at_period_end, lemon_squeezy_subscription_id, lemon_squeezy_customer_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        userId,
        plan.id,
        attributes.status === 'active' ? 'active' : 'pending',
        new Date(attributes.created_at),
        new Date(attributes.renews_at),
        attributes.cancelled,
        subscription.id,
        customerId
      ]
    );

    logger.info(`Created subscription for user ${userId}, plan ${plan.id}`);
  }

  /**
   * Handle subscription updates
   */
  private async handleSubscriptionUpdated(data: any): Promise<void> {
    const subscription = data.data;
    const attributes = subscription.attributes;
    const subscriptionId = subscription.id;

    await this.db.query(
      `UPDATE subscriptions SET
        status = $1,
        current_period_start = $2,
        current_period_end = $3,
        cancel_at_period_end = $4,
        updated_at = NOW()
      WHERE lemon_squeezy_subscription_id = $5`,
      [
        attributes.status === 'active' ? 'active' : attributes.status,
        new Date(attributes.created_at),
        new Date(attributes.renews_at),
        attributes.cancelled,
        subscriptionId
      ]
    );

    logger.info(`Updated subscription ${subscriptionId}`);
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCancelled(data: any): Promise<void> {
    const subscription = data.data;
    const subscriptionId = subscription.id;

    await this.db.query(
      `UPDATE subscriptions SET
        status = 'canceled',
        cancel_at_period_end = true,
        updated_at = NOW()
      WHERE lemon_squeezy_subscription_id = $1`,
      [subscriptionId]
    );

    logger.info(`Cancelled subscription ${subscriptionId}`);
  }

  /**
   * Handle subscription expiration
   */
  private async handleSubscriptionExpired(data: any): Promise<void> {
    const subscription = data.data;
    const subscriptionId = subscription.id;

    await this.db.query(
      `UPDATE subscriptions SET
        status = 'expired',
        updated_at = NOW()
      WHERE lemon_squeezy_subscription_id = $1`,
      [subscriptionId]
    );

    logger.info(`Expired subscription ${subscriptionId}`);
  }

  /**
   * Handle order creation
   */
  private async handleOrderCreated(data: any): Promise<void> {
    const order = data.data;
    const attributes = order.attributes;

    // Create invoice record
    await this.db.query(
      `INSERT INTO invoices (
        user_id, subscription_id, amount, currency, status,
        due_date, lemon_squeezy_invoice_id, invoice_url, created_at
      ) VALUES (
        (SELECT user_id FROM payment_customers WHERE lemon_squeezy_customer_id = $1),
        (SELECT id FROM subscriptions WHERE lemon_squeezy_subscription_id = $2),
        $3, $4, $5, $6, $7, $8, NOW()
      )`,
      [
        attributes.customer_id,
        attributes.subscription_id,
        attributes.total,
        attributes.currency,
        attributes.status,
        new Date(attributes.first_order_item.created_at),
        order.id,
        attributes.urls.invoice
      ]
    );

    logger.info(`Created invoice for order ${order.id}`);
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(data: any): Promise<void> {
    const order = data.data;
    const orderId = order.id;

    await this.db.query(
      `UPDATE invoices SET
        status = 'paid',
        paid_at = NOW()
      WHERE lemon_squeezy_invoice_id = $1`,
      [orderId]
    );

    logger.info(`Marked invoice as paid for order ${orderId}`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(data: any): Promise<void> {
    const order = data.data;
    const orderId = order.id;

    await this.db.query(
      `UPDATE invoices SET
        status = 'open'
      WHERE lemon_squeezy_invoice_id = $1`,
      [orderId]
    );

    logger.info(`Marked invoice as unpaid for order ${orderId}`);
  }

  /**
   * Get user's subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(userId: string, immediate: boolean = false): Promise<void> {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      if (immediate) {
        // Cancel immediately via Lemon Squeezy API
        await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemonSqueezySubscriptionId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${this.lemonSqueezyApiKey}`
          }
        });

        // Update database
        await this.db.query(
          `UPDATE subscriptions SET
            status = 'canceled',
            updated_at = NOW()
          WHERE id = $1`,
          [subscription.id]
        );
      } else {
        // Cancel at period end
        await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemonSqueezySubscriptionId}`, {
          method: 'PATCH',
          headers: {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            'Authorization': `Bearer ${this.lemonSqueezyApiKey}`
          },
          body: JSON.stringify({
            data: {
              type: 'subscriptions',
              id: subscription.lemonSqueezySubscriptionId,
              attributes: {
                cancelled: true
              }
            }
          })
        });

        // Update database
        await this.db.query(
          `UPDATE subscriptions SET
            cancel_at_period_end = true,
            updated_at = NOW()
          WHERE id = $1`,
          [subscription.id]
        );
      }

      logger.info(`Cancelled subscription for user ${userId}`);
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's usage metrics
   */
  async getUserUsage(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetrics> {
    try {
      // Get test count
      const testsResult = await this.db.query(
        `SELECT COUNT(*) as count FROM tests
         WHERE user_id = $1 AND created_at BETWEEN $2 AND $3`,
        [userId, periodStart, periodEnd]
      );

      // Get team member count
      const usersResult = await this.db.query(
        `SELECT COUNT(*) as count FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE t.owner_id = $1`,
        [userId]
      );

      // Get storage usage
      const storageResult = await this.db.query(
        `SELECT COALESCE(SUM(file_size), 0) as total FROM uploads
         WHERE user_id = $1`,
        [userId]
      );

      // Get API call count
      const apiCallsResult = await this.db.query(
        `SELECT COUNT(*) as count FROM api_logs
         WHERE user_id = $1 AND created_at BETWEEN $2 AND $3`,
        [userId, periodStart, periodEnd]
      );

      return {
        userId,
        period: periodStart,
        tests: parseInt(testsResult.rows[0].count),
        users: parseInt(usersResult.rows[0].count),
        storage: parseInt(storageResult.rows[0].total),
        apiCalls: parseInt(apiCallsResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Error getting user usage:', error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded plan limits
   */
  async checkPlanLimits(userId: string): Promise<{ withinLimits: boolean; exceeded: string[] }> {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (!subscription) {
        return { withinLimits: false, exceeded: ['no_subscription'] };
      }

      const plans = await this.getPlans();
      const plan = plans.find(p => p.id === subscription.planId);

      if (!plan) {
        return { withinLimits: false, exceeded: ['invalid_plan'] };
      }

      const usage = await this.getUserUsage(
        userId,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd
      );

      const exceeded: string[] = [];

      if (plan.limits.tests !== -1 && usage.tests > plan.limits.tests) {
        exceeded.push('tests');
      }

      if (plan.limits.users !== -1 && usage.users > plan.limits.users) {
        exceeded.push('users');
      }

      if (plan.limits.storage !== -1 && usage.storage > plan.limits.storage) {
        exceeded.push('storage');
      }

      if (plan.limits.apiCalls !== -1 && usage.apiCalls > plan.limits.apiCalls) {
        exceeded.push('api_calls');
      }

      return {
        withinLimits: exceeded.length === 0,
        exceeded
      };
    } catch (error) {
      logger.error('Error checking plan limits:', error);
      throw error;
    }
  }

  /**
   * Get user's billing history
   */
  async getBillingHistory(userId: string, limit: number = 50, offset: number = 0): Promise<Invoice[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM invoices
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = hmac.update(payload).digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

export const paymentService = new PaymentService();