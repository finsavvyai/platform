/**
 * SDLC.ai Product & Pricing Configuration
 * LemonSqueezy store integration for subscription management
 */

export const LEMONSQUEEZY_CONFIG = {
  storeId: process.env.LEMONSQUEEZY_STORE_ID || '214097',
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  signingSecret: process.env.LEMONSQUEEZY_SIGNING_SECRET!,
} as const;

export const PRODUCT_PREFIX = 'SDLC' as const;

/**
 * SDLC.ai plan configurations
 */
export const SDLC_PLANS = {
  starter: {
    id: 'sdlc_starter',
    name: `${PRODUCT_PREFIX}_Starter`,
    displayName: 'SDLC.ai Starter',
    price: 99,
    interval: 'month' as const,
    features: [
      'Basic RAG pipeline',
      'PII detection',
      'Audit logging',
      '10GB storage',
      'GDPR compliance',
      '3 team members',
      'Email support',
    ],
    limits: {
      ragQueries: 1000,
      documents: 100,
      vectorIndexes: 3,
      dlpScans: 500,
      apiRateLimit: 100,
      storageMB: 10240,
      teamMembers: 3,
    },
  },
  professional: {
    id: 'sdlc_professional',
    name: `${PRODUCT_PREFIX}_Professional`,
    displayName: 'SDLC.ai Professional',
    price: 499,
    interval: 'month' as const,
    features: [
      'Advanced RAG pipeline',
      'Full PII detection & redaction',
      'All compliance frameworks (GDPR, HIPAA, FINRA, PCI-DSS)',
      '100GB storage',
      '15 team members',
      'Realtime streaming',
      'Developer portal access',
      'Priority support',
      'Custom integrations',
    ],
    limits: {
      ragQueries: 10000,
      documents: 1000,
      vectorIndexes: 20,
      dlpScans: 5000,
      apiRateLimit: 1000,
      storageMB: 102400,
      teamMembers: 15,
    },
  },
  enterprise: {
    id: 'sdlc_enterprise',
    name: `${PRODUCT_PREFIX}_Enterprise`,
    displayName: 'SDLC.ai Enterprise',
    price: 0, // Custom pricing
    interval: 'month' as const,
    features: [
      'Enterprise RAG pipeline',
      'Zero-trust architecture',
      'All compliance frameworks (GDPR, HIPAA, FINRA, PCI-DSS, SOC2, ISO27001)',
      'Unlimited storage',
      'Unlimited team members',
      'Dedicated support',
      'Custom SLA',
      'On-premise deployment',
      'SAML SSO',
      'White-label options',
    ],
    limits: {
      ragQueries: -1,
      documents: -1,
      vectorIndexes: -1,
      dlpScans: -1,
      apiRateLimit: -1,
      storageMB: -1,
      teamMembers: -1,
    },
  },
} as const;

export type SDLCPlanId = keyof typeof SDLC_PLANS;

/**
 * Get plan by ID
 */
export function getPlan(planId: SDLCPlanId) {
  return SDLC_PLANS[planId];
}

/**
 * Get all LemonSqueezy product names
 */
export function getAllLemonSqueezyProductNames(): string[] {
  return Object.values(SDLC_PLANS).map(plan => plan.name);
}

/**
 * Check if a user's usage exceeds their plan limits
 */
export function isOverLimit(
  planId: SDLCPlanId,
  metric: keyof typeof SDLC_PLANS.starter.limits,
  currentUsage: number,
): boolean {
  const plan = SDLC_PLANS[planId];
  const limit = plan.limits[metric];
  if (limit === -1) return false; // unlimited
  return currentUsage >= limit;
}
