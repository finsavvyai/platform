import { Router, Request, Response } from 'express';
import StripeService from '../services/billing/StripeService';
import UsageTracker from '../services/billing/UsageTracker';
import { CheckoutConfig } from '../services/billing/types';

const router = Router();

/**
 * POST /api/billing/checkout
 * Create a Stripe checkout session for subscription upgrade
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { customerId, priceId, successUrl, cancelUrl, clientReferenceId } = req.body;

    // Validate inputs
    if (!customerId || !priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, priceId, successUrl, cancelUrl'
      });
    }

    const config: CheckoutConfig = {
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      clientReferenceId,
      metadata: {
        userId: clientReferenceId || customerId
      }
    };

    const session = await StripeService.createCheckoutSession(config);

    res.json({
      success: true,
      checkout: session
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/billing/portal
 * Create a customer portal session for subscription management
 */
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const { customerId, returnUrl } = req.body;

    if (!customerId || !returnUrl) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, returnUrl'
      });
    }

    const session = await StripeService.createPortalSession(
      customerId,
      returnUrl
    );

    res.json({
      success: true,
      portal: session
    });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({
      error: 'Failed to create billing portal session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    const result = await StripeService.handleWebhook(
      req.body,
      signature as string
    );

    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/usage
 * Get current usage statistics for user
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId'
      });
    }

    const usage = await UsageTracker.getUsage(userId, 'current');

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    console.error('Usage query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve usage statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/quota
 * Check quota status and limits for user
 */
router.get('/quota', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId'
      });
    }

    const quota = await UsageTracker.checkQuota(userId);

    res.json({
      success: true,
      quota
    });
  } catch (error) {
    console.error('Quota check error:', error);
    res.status(500).json({
      error: 'Failed to check quota status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/plans
 * List all available subscription plans
 */
router.get('/plans', (req: Request, res: Response) => {
  try {
    const plans = StripeService.getAvailablePlans();

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Plans list error:', error);
    res.status(500).json({
      error: 'Failed to retrieve plans',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/billing/record-test-run
 * Record a test run for usage tracking
 */
router.post('/record-test-run', async (req: Request, res: Response) => {
  try {
    const { userId, projectId } = req.body;

    if (!userId || !projectId) {
      return res.status(400).json({
        error: 'Missing required fields: userId, projectId'
      });
    }

    // Check if user has quota
    const allowed = await UsageTracker.enforceLimits(userId);
    if (!allowed) {
      return res.status(429).json({
        error: 'Quota exceeded. Please upgrade your plan.',
        quota: await UsageTracker.checkQuota(userId)
      });
    }

    // Record the test run
    await UsageTracker.recordTestRun(userId, projectId);

    res.json({
      success: true,
      message: 'Test run recorded successfully'
    });
  } catch (error) {
    console.error('Test run recording error:', error);
    res.status(500).json({
      error: 'Failed to record test run',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/estimate-cost
 * Estimate current month's cost for user
 */
router.get('/estimate-cost', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required query parameter: userId'
      });
    }

    const estimatedCost = await UsageTracker.estimateCost(userId);

    res.json({
      success: true,
      estimatedCost
    });
  } catch (error) {
    console.error('Cost estimation error:', error);
    res.status(500).json({
      error: 'Failed to estimate cost',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
