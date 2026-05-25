import { getPlanById } from './definitions.js';

const FEATURE_MATRIX: Record<string, Set<string>> = {
  starter: new Set([
    'basic_budgeting',
    'account_tracking',
    'email_support',
    'dashboard',
  ]),
  pro: new Set([
    'basic_budgeting',
    'account_tracking',
    'email_support',
    'dashboard',
    'advanced_analytics',
    'investment_tracking',
    'tax_reports',
    'api_access',
    'priority_support',
  ]),
  enterprise: new Set([
    'basic_budgeting',
    'account_tracking',
    'email_support',
    'dashboard',
    'advanced_analytics',
    'investment_tracking',
    'tax_reports',
    'api_access',
    'priority_support',
    'custom_integrations',
    'dedicated_support',
    'sla_guarantee',
    'advanced_security',
    'white_label',
  ]),
};

export function canAccessFeature(userPlan: string, feature: string): boolean {
  const plan = getPlanById(userPlan);

  if (!plan) {
    return false;
  }

  const features = FEATURE_MATRIX[plan.id];

  if (!features) {
    return false;
  }

  return features.has(feature);
}

export function getAvailableFeatures(userPlan: string): string[] {
  const plan = getPlanById(userPlan);

  if (!plan) {
    return [];
  }

  const features = FEATURE_MATRIX[plan.id];

  return features ? Array.from(features) : [];
}

export function isFeatureAvailableInPlan(feature: string, plan: string): boolean {
  return canAccessFeature(plan, feature);
}

export function getPlansThatIncludeFeature(feature: string): string[] {
  return Object.entries(FEATURE_MATRIX)
    .filter(([, features]) => features.has(feature))
    .map(([planId]) => planId);
}
