import { EventEmitter } from 'events';
import { stripeService } from './StripeService.js';
import {
  UserSubscription,
  Customer,
  Usage,
  UsageAlert,
  SubscriptionChangeRequest
} from '../types/subscription.js';
import { db } from '../lib/db.js';
import {
  teams,
  teamMembers
} from '../schema/index.js';
import {
  paymentCustomers,
  subscriptions,
  usageMetrics
} from '../schema/payment-schema.js';
import { eq, and } from 'drizzle-orm';
import {
  getPlanById,
  getUsageLimit,
  canUpgrade,
  canDowngrade,
  SUBSCRIPTION_PLANS
} from '../config/subscriptionPlans.js';
import { logger } from '../utils/logger.js';
import Stripe from 'stripe';

export class SubscriptionService extends EventEmitter {

  // Customer Management
  async createCustomer(userId: string, email: string, name?: string): Promise<Customer> {
    try {
      // Create customer in Stripe
      const stripeCustomer = await stripeService.createCustomer(email, name, { userId });

      // Store customer in database
      const customer: Customer = {
        id: `cust_${Date.now()}`,
        userId,
        stripeCustomerId: stripeCustomer.id,
        email,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await db.insert(paymentCustomers).values({
        userId,
        email,
        name: name || email,
        stripeCustomerId: stripeCustomer.id,
        lemonSqueezyCustomerId: `ls_${Date.now()}` // Fallback if required by schema constraint
      });

      this.emit('customer:created', { customer, userId });

      logger.info(`Created customer ${customer.id} for user ${userId}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to create customer: ${error}`);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  async getCustomerByUserId(userId: string): Promise<Customer | null> {
    try {
      const [team] = await db.select().from(teams)
        .where(eq(teams.ownerId, userId))
        .limit(1);

      if (!team) return null;

      return {
        id: team.id,
        userId,
        stripeCustomerId: (team as any).stripeCustomerId || '',
        email: '', // Will be populated from user data
        name: team.name,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      };
    } catch (error) {
      logger.error(`Failed to get customer: ${error}`);
      throw new Error(`Failed to get customer: ${error.message}`);
    }
  }

  // Subscription Management
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string,
    couponCode?: string
  ): Promise<{ subscription: UserSubscription; clientSecret?: string }> {
    try {
      const plan = getPlanById(planId);
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      // Get or create customer
      let customer = await this.getCustomerByUserId(userId);
      if (!customer) {
        // TODO: Get user email from user service
        customer = await this.createCustomer(userId, 'user@example.com');
      }

      // Create subscription in Stripe
      const stripeSubscription = await stripeService.createSubscription(
        customer.stripeCustomerId,
        plan.stripePriceId,
        paymentMethodId,
        plan.trialDays,
        couponCode
      );

      // Create subscription record
      const subscription: UserSubscription = {
        id: `sub_${Date.now()}`,
        userId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customer.stripeCustomerId,
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await db.insert(subscriptions).values({
        userId,
        planId,
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customer.stripeCustomerId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      });

      // Initialize usage tracking
      await this.initializeUsageTracking(userId);

      this.emit('subscription:created', { subscription, userId, planId });

      logger.info(`Created subscription ${subscription.id} for user ${userId} on plan ${planId}`);

      // Return client secret for payment confirmation if needed
      let clientSecret: string | undefined;
      if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice === 'object') {
        const paymentIntent = stripeSubscription.latest_invoice.payment_intent;
        if (paymentIntent && typeof paymentIntent === 'object') {
          clientSecret = paymentIntent.client_secret;
        }
      }

      return { subscription, clientSecret };
    } catch (error) {
      logger.error(`Failed to create subscription: ${error}`);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  async changeSubscription(request: SubscriptionChangeRequest): Promise<UserSubscription> {
    try {
      const { userId, newPlanId, prorationBehavior = 'create_prorations', effectiveDate = 'immediate' } = request;

      const currentSubscription = await this.getActiveSubscription(userId);
      if (!currentSubscription) {
        throw new Error('No active subscription found');
      }

      const currentPlan = getPlanById(currentSubscription.planId);
      const newPlan = getPlanById(newPlanId);

      if (!currentPlan || !newPlan) {
        throw new Error('Invalid plan ID');
      }

      // Validate the change
      const isUpgrade = canUpgrade(currentSubscription.planId, newPlanId);
      const isDowngrade = canDowngrade(currentSubscription.planId, newPlanId);

      if (!isUpgrade && !isDowngrade) {
        throw new Error('Invalid subscription change');
      }

      let updatedStripeSubscription: Stripe.Subscription;

      if (effectiveDate === 'immediate') {
        // Update immediately
        updatedStripeSubscription = await stripeService.updateSubscription(
          currentSubscription.stripeSubscriptionId,
          newPlan.stripePriceId,
          prorationBehavior
        );
      } else {
        // Schedule change for next billing cycle
        updatedStripeSubscription = await stripeService.updateSubscription(
          currentSubscription.stripeSubscriptionId,
          newPlan.stripePriceId,
          'none'
        );
      }

      // Update subscription record
      const updatedSubscription: UserSubscription = {
        ...currentSubscription,
        planId: newPlanId,
        status: updatedStripeSubscription.status as any,
        currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
        updatedAt: new Date(),
      };

      // Save to database
      await db.update(subscriptions)
        .set({
          planId: newPlanId,
          status: updatedStripeSubscription.status,
          currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: updatedStripeSubscription.cancel_at_period_end,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, currentSubscription.stripeSubscriptionId));

      this.emit('subscription:changed', {
        subscription: updatedSubscription,
        userId,
        oldPlanId: currentSubscription.planId,
        newPlanId,
        isUpgrade,
        isDowngrade
      });

      logger.info(`Changed subscription ${currentSubscription.id} from ${currentSubscription.planId} to ${newPlanId}`);

      return updatedSubscription;
    } catch (error) {
      logger.error(`Failed to change subscription: ${error}`);
      throw new Error(`Failed to change subscription: ${error.message}`);
    }
  }

  async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<UserSubscription> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Cancel in Stripe
      const stripeSubscription = await stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        cancelAtPeriodEnd
      );

      // Update subscription record
      const updatedSubscription: UserSubscription = {
        ...subscription,
        status: stripeSubscription.status as any,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await db.update(subscriptions)
        .set({
          status: stripeSubscription.status,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.stripeSubscriptionId));

      this.emit('subscription:canceled', { subscription: updatedSubscription, userId, cancelAtPeriodEnd });

      logger.info(`${cancelAtPeriodEnd ? 'Scheduled cancellation' : 'Immediately canceled'} subscription ${subscription.id}`);

      return updatedSubscription;
    } catch (error) {
      logger.error(`Failed to cancel subscription: ${error}`);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  async reactivateSubscription(userId: string): Promise<UserSubscription> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found');
      }

      if (!subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate in Stripe
      const stripeSubscription = await stripeService.reactivateSubscription(
        subscription.stripeSubscriptionId
      );

      // Update subscription record
      const updatedSubscription: UserSubscription = {
        ...subscription,
        status: stripeSubscription.status as any,
        cancelAtPeriodEnd: false,
        canceledAt: undefined,
        updatedAt: new Date(),
      };

      // Save to database
      await db.update(subscriptions)
        .set({
          status: stripeSubscription.status,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.stripeSubscriptionId));

      this.emit('subscription:reactivated', { subscription: updatedSubscription, userId });

      logger.info(`Reactivated subscription ${subscription.id}`);

      return updatedSubscription;
    } catch (error) {
      logger.error(`Failed to reactivate subscription: ${error}`);
      throw new Error(`Failed to reactivate subscription: ${error.message}`);
    }
  }

  async getActiveSubscription(userId: string): Promise<UserSubscription | null> {
    try {

      const [sub] = await db.select({
        subscription: subscriptions,
      })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active')
        ))
        .limit(1);

      if (!sub) return null;

      return {
        id: sub.subscription.id,
        userId,
        planId: (sub.subscription as any).plan,
        stripeSubscriptionId: sub.subscription.stripeSubscriptionId || '',
        stripeCustomerId: sub.subscription.stripeCustomerId || '',
        status: sub.subscription.status as any,
        currentPeriodStart: sub.subscription.currentPeriodStart || new Date(),
        currentPeriodEnd: sub.subscription.currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: sub.subscription.cancelAtPeriodEnd,
        createdAt: sub.subscription.createdAt,
        updatedAt: sub.subscription.updatedAt,
      };
    } catch (error) {
      logger.error(`Failed to get active subscription: ${error}`);
      throw new Error(`Failed to get active subscription: ${error.message}`);
    }
  }

  // Usage Tracking
  async initializeUsageTracking(userId: string): Promise<void> {
    const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM

    const usage: Usage = {
      userId,
      period: currentPeriod,
      recordingCount: 0,
      testExecutionCount: 0,
      storageUsedMB: 0,
      apiCallCount: 0,
      lastUpdated: new Date(),
    };

    // TODO: Save to database
    // await usageRepository.upsert(usage);
  }

  async trackUsage(userId: string, type: 'recording' | 'execution' | 'storage' | 'api', amount: number = 1): Promise<void> {
    try {
      const currentPeriod = new Date().toISOString().substring(0, 7);

      // TODO: Implement usage tracking in database
      // const usage = await usageRepository.findByUserAndPeriod(userId, currentPeriod);

      // Update usage counters
      // switch (type) {
      //   case 'recording':
      //     usage.recordingCount += amount;
      //     break;
      //   case 'execution':
      //     usage.testExecutionCount += amount;
      //     break;
      //   case 'storage':
      //     usage.storageUsedMB += amount;
      //     break;
      //   case 'api':
      //     usage.apiCallCount += amount;
      //     break;
      // }

      // usage.lastUpdated = new Date();
      // await usageRepository.update(usage);

      // Check for usage alerts
      await this.checkUsageAlerts(userId, type);

      this.emit('usage:tracked', { userId, type, amount });
    } catch (error) {
      logger.error(`Failed to track usage: ${error}`);
    }
  }

  async getCurrentUsage(userId: string): Promise<Usage | null> {
    try {
      const currentPeriod = new Date().toISOString().substring(0, 7);

      // TODO: Implement database lookup
      // return await usageRepository.findByUserAndPeriod(userId, currentPeriod);
      return null;
    } catch (error) {
      logger.error(`Failed to get current usage: ${error}`);
      throw new Error(`Failed to get current usage: ${error.message}`);
    }
  }

  async checkUsageAlerts(userId: string, type: 'recording' | 'execution' | 'storage' | 'api'): Promise<void> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) return;

      const usage = await this.getCurrentUsage(userId);
      if (!usage) return;

      const plan = getPlanById((subscription as any).planId);
      if (!plan) return;

      let currentUsage = 0;
      let limit = 0;

      switch (type) {
        case 'recording':
          currentUsage = usage.recordingCount;
          limit = plan.limits.recordingsPerMonth;
          break;
        case 'execution':
          currentUsage = usage.testExecutionCount;
          limit = plan.limits.testExecutionsPerMonth;
          break;
        case 'storage':
          currentUsage = usage.storageUsedMB / 1024; // Convert to GB
          limit = plan.limits.storageGB;
          break;
        case 'api':
          currentUsage = usage.apiCallCount;
          limit = plan.limits.apiCallsPerMonth;
          break;
      }

      // Skip if unlimited
      if (limit === -1) return;

      const percentage = (currentUsage / limit) * 100;
      const thresholds = [80, 90, 100];

      for (const threshold of thresholds) {
        if (percentage >= threshold) {
          await this.createUsageAlert(userId, type, threshold);
        }
      }
    } catch (error) {
      logger.error(`Failed to check usage alerts: ${error}`);
    }
  }

  async createUsageAlert(userId: string, type: string, threshold: number): Promise<void> {
    try {
      // Check if alert already exists
      // TODO: Implement database check
      // const existingAlert = await usageAlertRepository.findByUserAndTypeAndThreshold(userId, type, threshold);
      // if (existingAlert) return;

      const alert: UsageAlert = {
        id: `alert_${Date.now()}`,
        userId,
        type: type as any,
        threshold,
        triggered: true,
        notificationSent: false,
        createdAt: new Date(),
      };

      // TODO: Save to database
      // await usageAlertRepository.create(alert);

      this.emit('usage:alert', { alert, userId, type, threshold });

      logger.info(`Created usage alert for user ${userId}: ${type} at ${threshold}%`);
    } catch (error) {
      logger.error(`Failed to create usage alert: ${error}`);
    }
  }

  // Feature Access Control
  async canUseFeature(userId: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) {
        // Free tier access
        const freePlan = getPlanById('free');
        return freePlan?.features.some(f => f.name === feature && f.included) || false;
      }

      const plan = getPlanById((subscription as any).planId);
      if (!plan) return false;

      return plan.features.some(f => f.name === feature && f.included);
    } catch (error) {
      logger.error(`Failed to check feature access: ${error}`);
      return false;
    }
  }

  async hasUsageRemaining(userId: string, type: 'recording' | 'execution' | 'storage' | 'api'): Promise<boolean> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      const planId = subscription?.planId || 'free';

      const limit = getUsageLimit(planId, `${type}sPerMonth` as any);
      if (limit === -1) return true; // Unlimited

      const usage = await this.getCurrentUsage(userId);
      if (!usage) return true;

      let currentUsage = 0;
      switch (type) {
        case 'recording':
          currentUsage = usage.recordingCount;
          break;
        case 'execution':
          currentUsage = usage.testExecutionCount;
          break;
        case 'storage':
          currentUsage = usage.storageUsedMB / 1024; // Convert to GB
          break;
        case 'api':
          currentUsage = usage.apiCallCount;
          break;
      }

      return currentUsage < limit;
    } catch (error) {
      logger.error(`Failed to check usage remaining: ${error}`);
      return false;
    }
  }

  // Billing Portal
  async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
    try {
      const customer = await this.getCustomerByUserId(userId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const session = await stripeService.createBillingPortalSession(
        customer.stripeCustomerId,
        returnUrl
      );

      logger.info(`Created billing portal session for user ${userId}`);

      return session.url;
    } catch (error) {
      logger.error(`Failed to create billing portal session: ${error}`);
      throw new Error(`Failed to create billing portal session: ${error.message}`);
    }
  }

  // Webhook Handlers
  async handleStripeWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle webhook: ${error}`);
      throw error;
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info(`Subscription created: ${subscription.id}`);

    // Check if subscription already exists to avoid duplicates
    const [existing] = await db.select().from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existing) return;

    // Find customer to get userId
    const [customer] = await db.select().from(paymentCustomers)
      .where(eq(paymentCustomers.stripeCustomerId, subscription.customer as string))
      .limit(1);

    if (!customer) {
      logger.error(`Customer not found for subscription ${subscription.id} (Customer: ${subscription.customer})`);
      return;
    }

    await db.insert(subscriptions).values({
      userId: customer.userId,
      planId: subscription.items.data[0].price.id,
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    this.emit('stripe:subscription:created', subscription);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info(`Subscription updated: ${subscription.id}`);

    await db.update(subscriptions)
      .set({
        status: subscription.status,
        planId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    this.emit('stripe:subscription:updated', subscription);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info(`Subscription deleted: ${subscription.id}`);

    await db.update(subscriptions)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    this.emit('stripe:subscription:deleted', subscription);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info(`Payment succeeded for invoice: ${invoice.id}`);
    this.emit('stripe:payment:succeeded', invoice);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.info(`Payment failed for invoice: ${invoice.id}`);
    this.emit('stripe:payment:failed', invoice);
  }
}

export const subscriptionService = new SubscriptionService();