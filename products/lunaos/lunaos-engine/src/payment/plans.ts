/**
 * Payment plan definitions for Luna-OS
 */

import { Plan, PlanType } from './types';

export const PLANS: Record<PlanType, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    features: [
      'Unlimited commands',
      'All 140+ commands + pipe language',
      'CLI + Dashboard + Studio',
      'Bring your own API keys',
      'Community support',
    ],
    variantId: process.env.LEMONSQUEEZY_VARIANT_FREE || '1',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    currency: 'USD',
    features: [
      'Unlimited commands',
      'Managed AI keys (no BYOK needed)',
      '33 MCP servers pre-configured',
      'RAG code search + memory',
      'Visual QA + browser testing',
      'Priority support',
    ],
    variantId: process.env.LEMONSQUEEZY_VARIANT_PRO || '2',
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 79,
    currency: 'USD',
    features: [
      'Everything in Pro',
      'Team workspace + collaboration',
      'SSO / SAML',
      'Shared memory + team learnings',
      'Audit logs + compliance',
      'Dedicated support + SLA',
    ],
    variantId: process.env.LEMONSQUEEZY_VARIANT_TEAM || '3',
  },
};

export function getPlan(planId: PlanType): Plan {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Plan not found: ${planId}`);
  return plan;
}

export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

export function validatePlanId(planId: string): planId is PlanType {
  return Object.keys(PLANS).includes(planId);
}
