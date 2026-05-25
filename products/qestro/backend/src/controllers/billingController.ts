import { Request, Response } from 'express';
import { subscriptionService } from '../services/SubscriptionService.js';
import { stripeService } from '../services/StripeService.js';
import { getPlanById, SUBSCRIPTION_PLANS } from '../config/subscriptionPlans.js';
import { logger } from '../utils/logger.js';

export class BillingController {

  // Get available plans
  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = SUBSCRIPTION_PLANS.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
        limits: plan.limits,
        popular: plan.popular,
        trialDays: plan.trialDays,
      }));

      res.status(200).json({
        success: true,
        plans,
      });
    } catch (error) {
      logger.error(`Failed to get plans: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get plans',
        details: error.message,
      });
    }
  }

  // Create checkout session
  async createCheckoutSession(req: Request, res: Response): Promise<void> {
    try {
      const { planId, interval = 'month', couponCode } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!planId) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
      }

      const plan = getPlanById(planId);
      if (!plan) {
        res.status(400).json({ error: 'Invalid plan ID' });
        return;
      }

      if (plan.id === 'free') {
        res.status(400).json({ error: 'Cannot create checkout for free plan' });
        return;
      }

      // Get or create customer
      let customer = await subscriptionService.getCustomerByUserId(userId);
      if (!customer) {
        // TODO: Get user email from user service
        customer = await subscriptionService.createCustomer(userId, 'user@example.com');
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession(
        customer.stripeCustomerId,
        plan.stripePriceId,
        `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        `${process.env.FRONTEND_URL}/pricing`,
        plan.trialDays,
        couponCode
      );

      logger.info(`Created checkout session ${session.id} for user ${userId} and plan ${planId}`);

      res.status(200).json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      logger.error(`Failed to create checkout session: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to create checkout session',
        details: error.message,
      });
    }
  }

  // Handle successful checkout
  async handleCheckoutSuccess(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.query;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Retrieve checkout session from Stripe
      const session = await stripeService.getCheckoutSession(sessionId as string, {
        expand: ['subscription'],
      });

      if (session.subscription && typeof session.subscription === 'object') {
        const subscription = session.subscription;

        // Update subscription in database
        // TODO: Implement database update

        logger.info(`Checkout successful for user ${userId}, subscription ${subscription.id}`);
      }

      res.status(200).json({
        success: true,
        message: 'Subscription activated successfully',
      });
    } catch (error) {
      logger.error(`Failed to handle checkout success: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to process checkout success',
        details: error.message,
      });
    }
  }

  // Get current subscription
  async getCurrentSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const subscription = await subscriptionService.getActiveSubscription(userId);

      if (!subscription) {
        res.status(200).json({
          success: true,
          subscription: null,
          plan: getPlanById('free'), // Default to free plan
        });
        return;
      }

      const plan = getPlanById(subscription.planId);

      res.status(200).json({
        success: true,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          trialEnd: subscription.trialEnd,
        },
        plan,
      });
    } catch (error) {
      logger.error(`Failed to get current subscription: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get current subscription',
        details: error.message,
      });
    }
  }

  // Change subscription plan
  async changeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { newPlanId, prorationBehavior = 'create_prorations', effectiveDate = 'immediate' } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!newPlanId) {
        res.status(400).json({ error: 'New plan ID is required' });
        return;
      }

      const updatedSubscription = await subscriptionService.changeSubscription({
        userId,
        newPlanId,
        prorationBehavior,
        effectiveDate,
      });

      const plan = getPlanById(updatedSubscription.planId);

      res.status(200).json({
        success: true,
        subscription: updatedSubscription,
        plan,
        message: 'Subscription updated successfully',
      });
    } catch (error) {
      logger.error(`Failed to change subscription: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to change subscription',
        details: error.message,
      });
    }
  }

  // Cancel subscription
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { cancelAtPeriodEnd = true } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const updatedSubscription = await subscriptionService.cancelSubscription(userId, cancelAtPeriodEnd);

      res.status(200).json({
        success: true,
        subscription: updatedSubscription,
        message: cancelAtPeriodEnd
          ? 'Subscription will be canceled at the end of the current billing period'
          : 'Subscription canceled immediately',
      });
    } catch (error) {
      logger.error(`Failed to cancel subscription: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription',
        details: error.message,
      });
    }
  }

  // Reactivate subscription
  async reactivateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const updatedSubscription = await subscriptionService.reactivateSubscription(userId);

      res.status(200).json({
        success: true,
        subscription: updatedSubscription,
        message: 'Subscription reactivated successfully',
      });
    } catch (error) {
      logger.error(`Failed to reactivate subscription: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to reactivate subscription',
        details: error.message,
      });
    }
  }

  // Get billing portal URL
  async createBillingPortalSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const returnUrl = `${process.env.FRONTEND_URL}/billing`;
      const portalUrl = await subscriptionService.createBillingPortalSession(userId, returnUrl);

      res.status(200).json({
        success: true,
        portalUrl,
      });
    } catch (error) {
      logger.error(`Failed to create billing portal session: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to create billing portal session',
        details: error.message,
      });
    }
  }

  // Get usage data
  async getCurrentUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const usage = await subscriptionService.getCurrentUsage(userId);
      const subscription = await subscriptionService.getActiveSubscription(userId);
      const plan = getPlanById(subscription?.planId || 'free');

      res.status(200).json({
        success: true,
        usage: usage || {
          recordingCount: 0,
          testExecutionCount: 0,
          storageUsedMB: 0,
          apiCallCount: 0,
        },
        limits: plan?.limits || {},
        period: new Date().toISOString().substring(0, 7), // YYYY-MM
      });
    } catch (error) {
      logger.error(`Failed to get current usage: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get current usage',
        details: error.message,
      });
    }
  }

  // Get invoices
  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { limit = 10 } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const customer = await subscriptionService.getCustomerByUserId(userId);
      if (!customer) {
        res.status(200).json({
          success: true,
          invoices: [],
        });
        return;
      }

      const invoices = await stripeService.listInvoices(customer.stripeCustomerId, parseInt(limit as string));

      const formattedInvoices = invoices.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
        dueDate: new Date(invoice.due_date * 1000),
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      }));

      res.status(200).json({
        success: true,
        invoices: formattedInvoices,
      });
    } catch (error) {
      logger.error(`Failed to get invoices: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get invoices',
        details: error.message,
      });
    }
  }

  // Validate coupon
  async validateCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { couponCode } = req.body;

      if (!couponCode) {
        res.status(400).json({ error: 'Coupon code is required' });
        return;
      }

      const coupon = await stripeService.validateCoupon(couponCode);

      if (!coupon) {
        res.status(404).json({
          success: false,
          error: 'Invalid or expired coupon code',
        });
        return;
      }

      res.status(200).json({
        success: true,
        coupon: {
          id: coupon.id,
          percentOff: coupon.percent_off,
          amountOff: coupon.amount_off,
          currency: coupon.currency,
          duration: coupon.duration,
          durationInMonths: coupon.duration_in_months,
          name: coupon.name,
        },
      });
    } catch (error) {
      logger.error(`Failed to validate coupon: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to validate coupon',
        details: error.message,
      });
    }
  }

  // Stripe webhook handler
  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({ error: 'Missing stripe signature' });
        return;
      }

      const event = stripeService.constructWebhookEvent(req.body, signature);

      // Handle the event
      await subscriptionService.handleStripeWebhook(event);

      logger.info(`Successfully processed webhook event: ${event.type}`);

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error(`Webhook error: ${error}`);
      res.status(400).json({
        success: false,
        error: 'Webhook error',
        details: error.message,
      });
    }
  }

  // Check feature access
  async checkFeatureAccess(req: Request, res: Response): Promise<void> {
    try {
      const { feature } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const hasAccess = await subscriptionService.canUseFeature(userId, feature);

      res.status(200).json({
        success: true,
        hasAccess,
        feature,
      });
    } catch (error) {
      logger.error(`Failed to check feature access: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to check feature access',
        details: error.message,
      });
    }
  }

  // Check usage remaining
  async checkUsageRemaining(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params; // recording, execution, storage, api
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const hasUsageRemaining = await subscriptionService.hasUsageRemaining(userId, type as any);

      res.status(200).json({
        success: true,
        hasUsageRemaining,
        type,
      });
    } catch (error) {
      logger.error(`Failed to check usage remaining: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Failed to check usage remaining',
        details: error.message,
      });
    }
  }
}

export const billingController = new BillingController();