// Types
export * from './types.js';

// Clients
export { StripeClient } from './stripe/client.js';
export { LemonSqueezyClient } from './lemonsqueezy/client.js';

// Factory
export { createPaymentClient, createPaymentClientFromEnv } from './factory.js';
export type { PaymentClientConfig } from './factory.js';

// Webhook
export { WebhookHandler } from './webhook/handler.js';
export type { WebhookHandlerConfig } from './webhook/handler.js';
export {
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  getSignatureTimestamp,
  validateTimestamp,
  STRIPE_SIGNATURE_MAX_AGE_SECONDS,
} from './webhook/signature.js';

// Plans
export {
  STARTER_PLAN,
  PRO_PLAN,
  ENTERPRISE_PLAN,
  PLANS_BY_ID,
  getPlanById,
  getAllPlans,
} from './plans/definitions.js';
export type { Plan } from './plans/definitions.js';
export {
  canAccessFeature,
  getAvailableFeatures,
  isFeatureAvailableInPlan,
  getPlansThatIncludeFeature,
} from './plans/feature-gate.js';
