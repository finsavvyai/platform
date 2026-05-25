
import express from 'express';
import { billingController } from '../controllers/billingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', billingController.getPlans.bind(billingController));

// Protected routes
router.use(authenticateToken);

router.get('/subscription', billingController.getCurrentSubscription.bind(billingController));
router.get('/usage', billingController.getCurrentUsage.bind(billingController));
router.get('/invoices', billingController.getInvoices.bind(billingController));

router.post('/checkout', billingController.createCheckoutSession.bind(billingController));
router.post('/checkout/success', billingController.handleCheckoutSuccess.bind(billingController));

router.post('/subscription/change', billingController.changeSubscription.bind(billingController));
router.post('/subscription/cancel', billingController.cancelSubscription.bind(billingController));
router.post('/subscription/reactivate', billingController.reactivateSubscription.bind(billingController));

router.post('/portal', billingController.createBillingPortalSession.bind(billingController));
router.post('/coupons/validate', billingController.validateCoupon.bind(billingController));

export default router;
