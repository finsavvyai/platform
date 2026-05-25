import { Router } from 'express';
import { 
  createCheckout,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  getCustomerPortalUrl,
  handleWebhook
} from '../controllers/subscriptionController.js';
import { authenticateUser } from '../middleware/auth.js';
import { lemonSqueezyService } from '../services/LemonSqueezyService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Routes using the new controller
router.post('/create-checkout', authenticateUser, createCheckout);
router.get('/current', authenticateUser, getSubscription);
router.post('/cancel', authenticateUser, cancelSubscription);
router.post('/resume', authenticateUser, resumeSubscription);
router.get('/portal', authenticateUser, getCustomerPortalUrl);
router.post('/webhook/lemonsqueezy', handleWebhook);


/**
 * Get available plans with pricing
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          '100 AI test generations',
          '10 web recording sessions',
          '5 mobile recording sessions',
          'Community support',
          'No credit card required'
        ],
        variantId: null
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        currency: 'USD',
        interval: 'month',
        features: [
          '1,000 AI test generations',
          '100 recording sessions',
          '500 API tests',
          'Email support',
          '5 team members'
        ],
        variantId: process.env.LEMONSQUEEZY_VARIANT_ID_PRO
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited AI test generations',
          'Unlimited recording sessions',
          'Unlimited API tests',
          'Priority support',
          'Unlimited team members',
          'Custom integrations'
        ],
        variantId: process.env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE
      }
    ];

    res.json({ plans });
  } catch (error) {
    logger.error('Failed to get plans:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});


export default router;