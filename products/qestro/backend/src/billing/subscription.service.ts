/**
 * Subscription Management Service - Complete Billing System
 * Handles subscriptions, plans, usage tracking, and billing integration
 */

import Stripe from 'stripe';
import { DatabaseService } from '../services/DatabaseService';

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  billingInterval: 'month' | 'year';
  trialDays: number;
  features: string[];
  limits: Record<string, any>;
  stripePriceId?: string;
  isPublic: boolean;
  isActive: boolean;
}

interface Subscription {
  id: string;
  userId?: string;
  teamId?: string;
  planId: number;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

interface UsageMetrics {
  userId?: string;
  teamId?: string;
  metricType: string;
  metricValue: number;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, any>;
}

interface BillingEvent {
  type: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'payment_succeeded' | 'payment_failed';
  subscriptionId: string;
  userId?: string;
  teamId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class SubscriptionService {
  private readonly stripe: Stripe;
  private readonly db: DatabaseService;
  private readonly webhookSecret: string;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
    this.db = DatabaseService.getInstance();
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  }

  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const result = await this.db.query(
        `SELECT id, name, slug, description, price_cents, billing_interval,
                trial_days, features, limits, stripe_price_id, is_public, is_active
         FROM plans
         WHERE is_active = true
         ORDER BY sort_order ASC, price_cents ASC`
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        priceCents: row.price_cents,
        billingInterval: row.billing_interval,
        trialDays: row.trial_days,
        features: row.features,
        limits: row.limits,
        stripePriceId: row.stripe_price_id,
        isPublic: row.is_public,
        isActive: row.is_active
      }));

    } catch (error) {
      console.error('Get plans error:', error);
      throw new Error('Failed to get subscription plans');
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(params: {
    userId?: string;
    teamId?: string;
    planId: number;
    paymentMethodId: string;
    email: string;
    customerInfo?: {
      name: string;
      phone?: string;
      address?: {
        line1: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    };
    trialDays?: number;
  }): Promise<{ subscription: Subscription; clientSecret: string }> {
    try {
      // Get plan details
      const planResult = await this.db.query(
        'SELECT * FROM plans WHERE id = $1 AND is_active = true',
        [params.planId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Invalid plan ID');
      }

      const plan = planResult.rows[0];

      // Create or get Stripe customer
      let customerId: string;

      if (params.userId) {
        // Check if user already has a customer
        const existingSubResult = await this.db.query(
          'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
          [params.userId]
        );

        if (existingSubResult.rows.length > 0) {
          customerId = existingSubResult.rows[0].stripe_customer_id;
        } else {
          // Create new customer
          const customer = await this.stripe.customers.create({
            email: params.email,
            name: params.customerInfo?.name,
            phone: params.customerInfo?.phone,
            address: params.customerInfo?.address,
            metadata: {
              user_id: params.userId || '',
              team_id: params.teamId || '',
            }
          });
          customerId = customer.id;
        }
      } else {
        // Create customer for team
        const customer = await this.stripe.customers.create({
          email: params.email,
          name: params.customerInfo?.name,
          phone: params.customerInfo?.phone,
          address: params.customerInfo?.address,
          metadata: {
            team_id: params.teamId || '',
          }
        });
        customerId = customer.id;
      }

      // Create Stripe subscription
      const stripeSubscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: plan.stripe_price_id }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan_id: plan.id.toString(),
          user_id: params.userId || '',
          team_id: params.teamId || '',
        }
      };

      // Add trial if specified
      if (params.trialDays && params.trialDays > 0) {
        stripeSubscriptionParams.trial_period_days = params.trialDays;
      }

      const stripeSubscription = await this.stripe.subscriptions.create(stripeSubscriptionParams);

      // Create subscription in database
      const subscriptionResult = await this.db.query(
        `INSERT INTO subscriptions (
          user_id, team_id, plan_id, stripe_subscription_id, stripe_customer_id,
          status, current_period_start, current_period_end,
          trial_start, trial_end, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          params.userId,
          params.teamId,
          params.planId,
          stripeSubscription.id,
          customerId,
          stripeSubscription.status,
          new Date(stripeSubscription.current_period_start * 1000),
          new Date(stripeSubscription.current_period_end * 1000),
          stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          JSON.stringify({
            stripe_subscription: stripeSubscription,
            plan_name: plan.name,
          })
        ]
      );

      const subscription = this.mapSubscriptionFromDb(subscriptionResult.rows[0]);

      // Update team plan if team subscription
      if (params.teamId) {
        await this.db.query(
          'UPDATE teams SET plan_id = $1, subscription_id = $2, stripe_customer_id = $3 WHERE id = $4',
          [params.planId, subscription.id, customerId, params.teamId]
        );
      }

      const clientSecret = (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret;

      return { subscription, clientSecret };

    } catch (error) {
      console.error('Create subscription error:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const result = await this.db.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.features, p.limits
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = $1 AND s.status IN ('active', 'trialing', 'past_due')
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapSubscriptionFromDb(result.rows[0]);

    } catch (error) {
      console.error('Get user subscription error:', error);
      throw new Error('Failed to get user subscription');
    }
  }

  /**
   * Get team's current subscription
   */
  async getTeamSubscription(teamId: string): Promise<Subscription | null> {
    try {
      const result = await this.db.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.features, p.limits
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.team_id = $1 AND s.status IN ('active', 'trialing', 'past_due')
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [teamId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapSubscriptionFromDb(result.rows[0]);

    } catch (error) {
      console.error('Get team subscription error:', error);
      throw new Error('Failed to get team subscription');
    }
  }

  /**
   * Update subscription (change plan, quantity, etc.)
   */
  async updateSubscription(subscriptionId: string, params: {
    planId?: number;
    paymentMethodId?: string;
    cancelAtPeriodEnd?: boolean;
  }): Promise<Subscription> {
    try {
      // Get current subscription
      const currentResult = await this.db.query(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const currentSubscription = currentResult.rows[0];

      // Update Stripe subscription
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      if (params.planId) {
        // Get new plan
        const planResult = await this.db.query(
          'SELECT stripe_price_id FROM plans WHERE id = $1',
          [params.planId]
        );

        if (planResult.rows.length === 0) {
          throw new Error('Invalid plan ID');
        }

        updateParams.items = [{
          id: (currentSubscription.metadata as any)?.stripe_subscription?.items?.data[0]?.id,
          price: planResult.rows[0].stripe_price_id,
        }];
      }

      if (params.paymentMethodId) {
        updateParams.default_payment_method = params.paymentMethodId;
      }

      if (params.cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = params.cancelAtPeriodEnd;
      }

      const stripeSubscription = await this.stripe.subscriptions.update(
        currentSubscription.stripe_subscription_id!,
        updateParams
      );

      // Update database
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (params.planId) {
        updateFields.push(`plan_id = $${paramIndex}`);
        updateValues.push(params.planId);
        paramIndex++;
      }

      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(stripeSubscription.status);
      paramIndex++;

      updateFields.push(`current_period_start = $${paramIndex}`);
      updateValues.push(new Date(stripeSubscription.current_period_start * 1000));
      paramIndex++;

      updateFields.push(`current_period_end = $${paramIndex}`);
      updateValues.push(new Date(stripeSubscription.current_period_end * 1000));
      paramIndex++;

      if (params.cancelAtPeriodEnd !== undefined) {
        updateFields.push(`cancel_at_period_end = $${paramIndex}`);
        updateValues.push(params.cancelAtPeriodEnd);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(subscriptionId);

      await this.db.query(
        `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );

      // Get updated subscription
      const updatedResult = await this.db.query(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );

      return this.mapSubscriptionFromDb(updatedResult.rows[0]);

    } catch (error) {
      console.error('Update subscription error:', error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<void> {
    try {
      const subscriptionResult = await this.db.query(
        'SELECT stripe_subscription_id FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (subscriptionResult.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const stripeSubscriptionId = subscriptionResult.rows[0].stripe_subscription_id;

      if (immediate) {
        // Cancel immediately
        await this.stripe.subscriptions.cancel(stripeSubscriptionId);

        await this.db.query(
          `UPDATE subscriptions
           SET status = 'canceled', ended_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [subscriptionId]
        );
      } else {
        // Cancel at period end
        await this.stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await this.db.query(
          `UPDATE subscriptions
           SET cancel_at_period_end = true, updated_at = NOW()
           WHERE id = $1`,
          [subscriptionId]
        );
      }

    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Record usage metrics
   */
  async recordUsage(metrics: UsageMetrics): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO usage_metrics
         (user_id, team_id, metric_type, metric_value, period_start, period_end, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, team_id, metric_type, period_start, period_end)
         DO UPDATE SET
           metric_value = usage_metrics.metric_value + EXCLUDED.metric_value,
           updated_at = NOW()`,
        [
          metrics.userId,
          metrics.teamId,
          metrics.metricType,
          metrics.metricValue,
          metrics.periodStart,
          metrics.periodEnd,
          JSON.stringify(metrics.metadata || {})
        ]
      );

    } catch (error) {
      console.error('Record usage error:', error);
      throw new Error('Failed to record usage metrics');
    }
  }

  /**
   * Get current usage for a user/team
   */
  async getCurrentUsage(params: {
    userId?: string;
    teamId?: string;
    metricType?: string;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<any[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.userId) {
        conditions.push(`user_id = $${paramIndex}`);
        values.push(params.userId);
        paramIndex++;
      }

      if (params.teamId) {
        conditions.push(`team_id = $${paramIndex}`);
        values.push(params.teamId);
        paramIndex++;
      }

      if (params.metricType) {
        conditions.push(`metric_type = $${paramIndex}`);
        values.push(params.metricType);
        paramIndex++;
      }

      if (params.periodStart) {
        conditions.push(`period_start >= $${paramIndex}`);
        values.push(params.periodStart);
        paramIndex++;
      }

      if (params.periodEnd) {
        conditions.push(`period_end <= $${paramIndex}`);
        values.push(params.periodEnd);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await this.db.query(
        `SELECT metric_type, SUM(metric_value) as total_value,
                MIN(period_start) as period_start, MAX(period_end) as period_end
         FROM usage_metrics
         ${whereClause}
         GROUP BY metric_type
         ORDER BY metric_type`,
        values
      );

      return result.rows;

    } catch (error) {
      console.error('Get current usage error:', error);
      throw new Error('Failed to get current usage');
    }
  }

  /**
   * Check if user/team has exceeded their plan limits
   */
  async checkUsageLimits(params: {
    userId?: string;
    teamId?: string;
    metricType: string;
    additionalAmount?: number;
  }): Promise<{ withinLimit: boolean; current: number; limit: number; remaining: number }> {
    try {
      // Get subscription with limits
      let subscription: Subscription | null = null;

      if (params.userId) {
        subscription = await this.getUserSubscription(params.userId);
      } else if (params.teamId) {
        subscription = await this.getTeamSubscription(params.teamId);
      }

      if (!subscription) {
        // No active subscription, return free plan limits
        const freePlan = await this.db.query(
          'SELECT limits FROM plans WHERE slug = $1',
          ['free']
        );

        const limits = freePlan.rows[0]?.limits || {};
        const limit = limits[params.metricType] || 0;

        return {
          withinLimit: false,
          current: 0,
          limit,
          remaining: 0
        };
      }

      const planLimits = (subscription as any).limits || {};
      const limit = planLimits[params.metricType];

      // If limit is -1 or undefined, it's unlimited
      if (!limit || limit === -1) {
        return {
          withinLimit: true,
          current: 0,
          limit: -1,
          remaining: -1
        };
      }

      // Get current usage for this billing period
      const currentUsage = await this.getCurrentUsage({
        userId: params.userId,
        teamId: params.teamId,
        metricType: params.metricType,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd
      });

      const current = currentUsage.find(usage => usage.metric_type === params.metricType)?.total_value || 0;
      const additional = params.additionalAmount || 0;
      const total = current + additional;
      const remaining = Math.max(0, limit - total);

      return {
        withinLimit: total <= limit,
        current,
        limit,
        remaining
      };

    } catch (error) {
      console.error('Check usage limits error:', error);
      throw new Error('Failed to check usage limits');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(eventBody: string, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(eventBody, signature, this.webhookSecret);

      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

    } catch (error) {
      console.error('Webhook handling error:', error);
      throw new Error('Webhook signature verification failed');
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(params: {
    userId?: string;
    teamId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.userId) {
        conditions.push(`s.user_id = $${paramIndex}`);
        values.push(params.userId);
        paramIndex++;
      }

      if (params.teamId) {
        conditions.push(`s.team_id = $${paramIndex}`);
        values.push(params.teamId);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = params.limit ? `LIMIT $${paramIndex++}` : '';
      if (params.limit) values.push(params.limit);
      const offsetClause = params.offset ? `OFFSET $${paramIndex++}` : '';
      if (params.offset) values.push(params.offset);

      const result = await this.db.query(
        `SELECT s.*, p.name as plan_name, p.price_cents, p.billing_interval
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         ${whereClause}
         ORDER BY s.created_at DESC
         ${limitClause} ${offsetClause}`,
        values
      );

      return result.rows;

    } catch (error) {
      console.error('Get billing history error:', error);
      throw new Error('Failed to get billing history');
    }
  }

  /**
   * Create customer portal session
   */
  async createCustomerPortalSession(params: {
    userId?: string;
    teamId?: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    try {
      // Get customer ID
      let customerId: string;

      if (params.userId) {
        const result = await this.db.query(
          'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
          [params.userId]
        );

        if (result.rows.length === 0) {
          throw new Error('No active subscription found');
        }

        customerId = result.rows[0].stripe_customer_id;
      } else {
        const result = await this.db.query(
          'SELECT stripe_customer_id FROM teams WHERE id = $1 AND stripe_customer_id IS NOT NULL',
          [params.teamId!]
        );

        if (result.rows.length === 0) {
          throw new Error('No active subscription found');
        }

        customerId = result.rows[0].stripe_customer_id;
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: params.returnUrl,
      });

      return { url: session.url };

    } catch (error) {
      console.error('Create customer portal session error:', error);
      throw new Error('Failed to create customer portal session');
    }
  }

  // Private helper methods

  private mapSubscriptionFromDb(dbRow: any): Subscription {
    return {
      id: dbRow.id,
      userId: dbRow.user_id,
      teamId: dbRow.team_id,
      planId: dbRow.plan_id,
      status: dbRow.status,
      currentPeriodStart: dbRow.current_period_start,
      currentPeriodEnd: dbRow.current_period_end,
      trialStart: dbRow.trial_start,
      trialEnd: dbRow.trial_end,
      cancelAtPeriodEnd: dbRow.cancel_at_period_end,
      canceledAt: dbRow.canceled_at,
      endedAt: dbRow.ended_at,
      stripeSubscriptionId: dbRow.stripe_subscription_id,
      stripeCustomerId: dbRow.stripe_customer_id,
    };
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      await this.db.query(
        `UPDATE subscriptions
         SET status = 'active', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [invoice.subscription as string]
      );
    }

    console.log(`Invoice payment succeeded: ${invoice.id}`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      await this.db.query(
        `UPDATE subscriptions
         SET status = 'past_due', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [invoice.subscription as string]
      );
    }

    console.log(`Invoice payment failed: ${invoice.id}`);
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    await this.db.query(
      `UPDATE subscriptions
       SET status = $1, updated_at = NOW()
       WHERE stripe_subscription_id = $2`,
      [subscription.status, subscription.id]
    );

    console.log(`Subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    await this.db.query(
      `UPDATE subscriptions
       SET status = $1,
           current_period_start = $2,
           current_period_end = $3,
           cancel_at_period_end = $4,
           updated_at = NOW()
       WHERE stripe_subscription_id = $5`,
      [
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.cancel_at_period_end,
        subscription.id
      ]
    );

    console.log(`Subscription updated: ${subscription.id}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.db.query(
      `UPDATE subscriptions
       SET status = 'canceled', ended_at = NOW(), updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );

    console.log(`Subscription deleted: ${subscription.id}`);
  }
}

export default SubscriptionService;
