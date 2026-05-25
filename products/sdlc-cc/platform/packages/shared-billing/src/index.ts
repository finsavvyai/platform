// Export all types
export * from './types';

// Export main billing manager
export { BillingManager } from './billing-manager';

// Export API routes
export { createBillingRoutes, initBillingServer } from './api';

// Default configuration for easy setup
export { DEFAULT_TIER_CONFIGS } from './types';

// Re-export @finsavvyai/pay utilities for consumers
export {
  createPaymentClient,
  createPaymentClientFromEnv,
  WebhookHandler,
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  canAccessFeature,
  getPlanById,
  getAllPlans,
} from '@finsavvyai/pay';

// Version
export const VERSION = '1.0.0';
