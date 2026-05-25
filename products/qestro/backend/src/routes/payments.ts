/**
 * Payment Routes
 * API endpoints for payment processing, subscription management, and billing
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import { paymentService } from '../services/PaymentService.js';
import { stripeService } from '../services/StripeService.js';
import { subscriptionService } from '../services/SubscriptionService.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

/**
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await paymentService.getPlans();
    res.json({ plans });
  } catch (error) {
    logger.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

/**
 * Create checkout session
 */
router.post('/checkout', authenticateToken, validateRequest({
  body: {
    planId: { type: 'string', required: true },
    successUrl: { type: 'string', required: true },
    cancelUrl: { type: 'string', required: true }
  }
} as any), async (req, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.user!.userId;

    const result = await paymentService.createCheckoutSession(userId, planId, successUrl, cancelUrl);

    res.json(result);
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * Get user's current subscription
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const subscription = await paymentService.getUserSubscription(userId);

    if (!subscription) {
      res.json({ subscription: null });
      return;
    }

    // Get plan details
    const plans = await paymentService.getPlans();
    const plan = plans.find(p => p.id === subscription.planId);

    res.json({
      subscription: {
        ...subscription,
        plan
      }
    });
  } catch (error) {
    logger.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * Cancel subscription
 */
router.post('/subscription/cancel', authenticateToken, validateRequest({
  body: {
    immediate: { type: 'boolean', required: false, default: false }
  }
} as any), async (req, res) => {
  try {
    const { immediate } = req.body;
    const userId = req.user!.userId;

    await paymentService.cancelSubscription(userId, immediate);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);

    if (error.message === 'No active subscription found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
});

/**
 * Get user's usage metrics
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { period = 'current' } = req.query;

    let periodStart: Date;
    let periodEnd: Date;

    if (period === 'current') {
      // Current billing period
      const subscription = await paymentService.getUserSubscription(userId);
      if (!subscription) {
        res.json({ usage: null });
        return;
      }
      periodStart = subscription.currentPeriodStart;
      periodEnd = subscription.currentPeriodEnd;
    } else if (period === 'last') {
      // Last month
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      // Custom period
      periodStart = new Date(req.query.start as string);
      periodEnd = new Date(req.query.end as string);
    }

    const usage = await paymentService.getUserUsage(userId, periodStart, periodEnd);

    res.json({ usage });
  } catch (error) {
    logger.error('Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage metrics' });
  }
});

/**
 * Check plan limits
 */
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await paymentService.checkPlanLimits(userId);

    res.json(result);
  } catch (error) {
    logger.error('Error checking plan limits:', error);
    res.status(500).json({ error: 'Failed to check plan limits' });
  }
});

/**
 * Get billing history
 */
router.get('/billing-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const invoices = await paymentService.getBillingHistory(userId, limit, offset);

    res.json({ invoices });
  } catch (error) {
    logger.error('Error getting billing history:', error);
    res.status(500).json({ error: 'Failed to get billing history' });
  }
});

/**
 * Download invoice
 */
router.get('/invoices/:invoiceId/download', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user!.userId;

    // Get invoice from database
    const result = await DatabaseService.getInstance().query(
      `SELECT * FROM invoices WHERE id = $1 AND user_id = $2`,
      [invoiceId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const invoice = result.rows[0];

    // Redirect to Lemon Squeezy invoice URL
    res.redirect(302, invoice.invoice_url);
  } catch (error) {
    logger.error('Error downloading invoice:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

/**
 * Webhook handler for Lemon Squeezy events
 */
router.post('/webhook/lemonsqueezy', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-lemonsqueezy-signature'] as string;
    const payload = req.body.toString();

    // Verify webhook signature
    if (!paymentService.verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid webhook signature received');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.headers['x-lemonsqueezy-event'] as string;
    const data = JSON.parse(payload);

    // Process webhook event
    await paymentService.handleWebhook(event, data);

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Webhook handler for Stripe events
 */
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    // Check if we are in development/wiremock mode
    let event;
    if (process.env.STRIPE_API_BASE) {
      // In dev, bypass signature verification or use a simplified one if WireMock sends one
      event = JSON.parse(req.body.toString());
    } else {
      event = stripeService.constructWebhookEvent(req.body, signature);
    }

    // Process webhook event
    await subscriptionService.handleStripeWebhook(event);

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Stripe webhook:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

/**
 * Update payment method (placeholder for future implementation)
 */
router.put('/payment-method', authenticateToken, validateRequest({
  body: {
    type: { type: 'string', required: true },
    token: { type: 'string', required: true },
    isDefault: { type: 'boolean', required: false }
  }
} as any), async (req, res) => {
  try {
    // TODO: Implement payment method updates
    res.status(501).json({ error: 'Payment method updates not yet implemented' });
  } catch (error) {
    logger.error('Error updating payment method:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

/**
 * Get payment methods (placeholder for future implementation)
 */
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement payment methods retrieval
    res.status(501).json({ error: 'Payment methods not yet implemented' });
  } catch (error) {
    logger.error('Error getting payment methods:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

/**
 * Apply promo code (placeholder for future implementation)
 */
router.post('/promo-code', authenticateToken, validateRequest({
  body: {
    code: { type: 'string', required: true },
    planId: { type: 'string', required: true }
  }
} as any), async (req, res) => {
  try {
    // TODO: Implement promo code validation
    res.status(501).json({ error: 'Promo codes not yet implemented' });
  } catch (error) {
    logger.error('Error applying promo code:', error);
    res.status(500).json({ error: 'Failed to apply promo code' });
  }
});

/**
 * Get customer portal URL (placeholder for future implementation)
 */
router.get('/portal', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement customer portal (Stripe Customer Portal equivalent)
    res.status(501).json({ error: 'Customer portal not yet implemented' });
  } catch (error) {
    logger.error('Error getting portal URL:', error);
    res.status(500).json({ error: 'Failed to get portal URL' });
  }
});

/**
 * Estimate subscription cost with proration
 */
router.post('/estimate', authenticateToken, validateRequest({
  body: {
    planId: { type: 'string', required: true },
    billingCycle: { type: 'string', enum: ['monthly', 'yearly'], required: false }
  }
} as any), async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const userId = req.user!.userId;

    // Get current subscription
    const currentSubscription = await paymentService.getUserSubscription(userId);

    // Get plan details
    const plans = await paymentService.getPlans();
    const newPlan = plans.find(p => p.id === planId);

    if (!newPlan) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    let estimate = {
      subtotal: newPlan.price,
      tax: 0,
      total: newPlan.price,
      currency: newPlan.currency,
      proration: 0,
      immediateCharge: newPlan.price
    };

    // If user has current subscription, calculate proration
    if (currentSubscription) {
      const currentPlan = plans.find(p => p.id === currentSubscription.planId);
      if (currentPlan) {
        const daysRemaining = Math.ceil(
          (currentSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const daysInPeriod = Math.ceil(
          (currentSubscription.currentPeriodEnd.getTime() - currentSubscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Simple proration calculation
        const prorationAmount = (currentPlan.price * daysRemaining) / daysInPeriod;
        const newPlanProration = (newPlan.price * daysRemaining) / daysInPeriod;

        estimate = {
          ...estimate,
          proration: newPlanProration - prorationAmount,
          immediateCharge: newPlan.price + (newPlanProration - prorationAmount)
        };
      }
    }

    res.json({ estimate });
  } catch (error) {
    logger.error('Error calculating estimate:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

export default router;