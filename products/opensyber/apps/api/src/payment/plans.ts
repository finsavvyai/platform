/**
 * Subscription plans and pricing configuration.
 * Defines free, pro, and enterprise plans with features and variant IDs.
 */

import type { Plan, PlanConfig } from './types.js';

/** Default variant IDs — override at runtime via `getPlanConfig(planId, env)`. */
const DEFAULT_VARIANT_PRO = 'variant_pro';
const DEFAULT_VARIANT_TEAM = 'variant_enterprise';

function buildPlans(variantPro: string, variantTeam: string): Record<Plan, PlanConfig> {
  return {
    free: {
      id: 'free',
      name: 'Free',
      variantId: '0',
      price: 0,
      currency: 'USD',
      features: ['Basic token management', 'Up to 5 tokens', 'Community support'],
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      variantId: variantPro,
      price: 2999,
      currency: 'USD',
      features: [
        'Unlimited tokens',
        'Advanced analytics',
        'API access',
        'Priority support',
        'Custom integrations',
      ],
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      variantId: variantTeam,
      price: 9999,
      currency: 'USD',
      features: [
        'Everything in Pro',
        'Dedicated support',
        'Custom contracts',
        'On-premises option',
        'SLA guarantee',
      ],
    },
  };
}

interface PlanEnvOverrides {
  OPENSYBER_LS_VARIANT_PRO?: string;
  OPENSYBER_LS_VARIANT_TEAM?: string;
}

export function getPlanConfig(planId: Plan, env?: PlanEnvOverrides): PlanConfig {
  const plans = buildPlans(
    env?.OPENSYBER_LS_VARIANT_PRO || DEFAULT_VARIANT_PRO,
    env?.OPENSYBER_LS_VARIANT_TEAM || DEFAULT_VARIANT_TEAM,
  );
  const plan = plans[planId];
  if (!plan) throw new Error(`Plan not found: ${planId}`);
  return plan;
}

const VALID_PLANS: readonly Plan[] = ['free', 'pro', 'enterprise'];

export function getAllPlans(env?: PlanEnvOverrides): PlanConfig[] {
  const plans = buildPlans(
    env?.OPENSYBER_LS_VARIANT_PRO || DEFAULT_VARIANT_PRO,
    env?.OPENSYBER_LS_VARIANT_TEAM || DEFAULT_VARIANT_TEAM,
  );
  return Object.values(plans);
}

export function isValidPlan(planId: string): planId is Plan {
  return VALID_PLANS.includes(planId as Plan);
}
