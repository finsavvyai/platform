import { Router } from 'express';
import { emailService } from '../../services/EmailService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/email/status
 * Check the status of all configured email providers
 */
router.get('/status', async (req, res) => {
  try {
    const providerStatus = await emailService.verifyAllProviders();

    res.json({
      success: true,
      data: {
        providers: providerStatus,
        totalProviders: Object.keys(providerStatus).length,
        workingProviders: Object.values(providerStatus).filter(Boolean).length,
        configured: Object.keys(providerStatus).length > 0
      }
    });
  } catch (error) {
    logger.error('Email status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email provider status'
    });
  }
});

/**
 * POST /api/email/test-welcome
 * Send a test welcome email
 */
router.post('/test-welcome', async (req, res) => {
  try {
    const { email, name = 'Test User', plan = 'qs-qestro-professional-monthly' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const result = await emailService.sendWelcomeEmail(email, name, plan);

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          provider: result.provider,
          email: email,
          plan: plan,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    logger.error('Test welcome email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test welcome email'
    });
  }
});

/**
 * POST /api/email/test-payment
 * Send a test payment confirmation email
 */
router.post('/test-payment', async (req, res) => {
  try {
    const {
      email,
      name = 'Test User',
      plan = 'qs-qestro-enterprise-monthly',
      orderId = 'test_order_' + Date.now(),
      amount = 4700, // $47.00 in cents
      currency = 'USD'
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const result = await emailService.sendPaymentConfirmationEmail(
      email,
      name,
      plan,
      orderId,
      amount,
      currency
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          provider: result.provider,
          email: email,
          plan: plan,
          orderId: orderId,
          amount: amount,
          currency: currency,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    logger.error('Test payment email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test payment email'
    });
  }
});

/**
 * POST /api/email/test-cancellation
 * Send a test subscription cancelled email
 */
router.post('/test-cancellation', async (req, res) => {
  try {
    const {
      email,
      name = 'Test User',
      plan = 'qs-qestro-professional-monthly',
      daysUntilEnd = 7
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const effectiveDate = new Date(Date.now() + (daysUntilEnd * 24 * 60 * 60 * 1000));

    const result = await emailService.sendSubscriptionCancelledEmail(
      email,
      name,
      plan,
      effectiveDate
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          provider: result.provider,
          email: email,
          plan: plan,
          effectiveDate: effectiveDate.toISOString(),
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    logger.error('Test cancellation email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test cancellation email'
    });
  }
});

/**
 * POST /api/email/test-payment-failed
 * Send a test payment failed email
 */
router.post('/test-payment-failed', async (req, res) => {
  try {
    const {
      email,
      name = 'Test User',
      plan = 'qs-qestro-professional-monthly',
      amount = 1900, // $19.00 in cents
      daysUntilRetry = 3
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const retryDate = new Date(Date.now() + (daysUntilRetry * 24 * 60 * 60 * 1000));

    const result = await emailService.sendPaymentFailedEmail(
      email,
      name,
      plan,
      amount,
      retryDate
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          provider: result.provider,
          email: email,
          plan: plan,
          amount: amount,
          retryDate: retryDate.toISOString(),
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    logger.error('Test payment failed email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test payment failed email'
    });
  }
});

/**
 * POST /api/email/test-trial-ending
 * Send a test trial ending reminder email
 */
router.post('/test-trial-ending', async (req, res) => {
  try {
    const {
      email,
      name = 'Test User',
      plan = 'qs-qestro-professional-monthly',
      daysRemaining = 3
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const result = await emailService.sendTrialEndingReminder(
      email,
      name,
      plan,
      daysRemaining
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          provider: result.provider,
          email: email,
          plan: plan,
          daysRemaining: daysRemaining,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }
  } catch (error) {
    logger.error('Test trial ending email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test trial ending email'
    });
  }
});

/**
 * GET /api/email/plans
 * Get available plan configurations
 */
router.get('/plans', (req, res) => {
  try {
    const plans = {
      'qs-qestro-free': {
        name: 'Free',
        description: 'Perfect for individuals and small projects',
        features: ['100 AI tests/month', '10 web recordings', '5 mobile recordings']
      },
      'qs-qestro-professional-monthly': {
        name: 'Professional',
        description: 'Advanced features for growing teams',
        features: ['Unlimited AI tests', 'Unlimited recordings', 'Priority support']
      },
      'qs-qestro-enterprise-monthly': {
        name: 'Enterprise',
        description: 'Complete solution for large organizations',
        features: ['Everything in Professional', 'Custom integrations', 'Dedicated support']
      }
    };

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Get plans failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get plan configurations'
    });
  }
});

export default router;