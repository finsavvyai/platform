import { describe, it, expect } from 'vitest';
import {
  STARTER_PLAN,
  PRO_PLAN,
  ENTERPRISE_PLAN,
  getPlanById,
  getAllPlans,
} from '../src/plans/definitions.js';
import {
  canAccessFeature,
  getAvailableFeatures,
  isFeatureAvailableInPlan,
  getPlansThatIncludeFeature,
} from '../src/plans/feature-gate.js';

describe('Plan Definitions', () => {
  it('should define starter plan correctly', () => {
    expect(STARTER_PLAN.id).toBe('starter');
    expect(STARTER_PLAN.name).toBe('Starter');
    expect(STARTER_PLAN.price).toBe(29);
    expect(STARTER_PLAN.interval).toBe('month');
    expect(STARTER_PLAN.features.length).toBeGreaterThan(0);
  });

  it('should define pro plan correctly', () => {
    expect(PRO_PLAN.id).toBe('pro');
    expect(PRO_PLAN.name).toBe('Pro');
    expect(PRO_PLAN.price).toBe(79);
    expect(PRO_PLAN.interval).toBe('month');
    expect(PRO_PLAN.features.length).toBeGreaterThan(STARTER_PLAN.features.length);
  });

  it('should define enterprise plan correctly', () => {
    expect(ENTERPRISE_PLAN.id).toBe('enterprise');
    expect(ENTERPRISE_PLAN.name).toBe('Enterprise');
    expect(ENTERPRISE_PLAN.price).toBe(299);
    expect(ENTERPRISE_PLAN.interval).toBe('month');
    expect(ENTERPRISE_PLAN.features.length).toBeGreaterThan(PRO_PLAN.features.length);
  });

  it('should have stripe price ids', () => {
    expect(STARTER_PLAN.stripePriceId).toBeDefined();
    expect(PRO_PLAN.stripePriceId).toBeDefined();
    expect(ENTERPRISE_PLAN.stripePriceId).toBeDefined();
  });

  it('should have lemonsqueezy variant ids', () => {
    expect(STARTER_PLAN.lemonSqueezyVariantId).toBeDefined();
    expect(PRO_PLAN.lemonSqueezyVariantId).toBeDefined();
    expect(ENTERPRISE_PLAN.lemonSqueezyVariantId).toBeDefined();
  });

  it('should get plan by id', () => {
    expect(getPlanById('starter')).toBe(STARTER_PLAN);
    expect(getPlanById('pro')).toBe(PRO_PLAN);
    expect(getPlanById('enterprise')).toBe(ENTERPRISE_PLAN);
  });

  it('should return null for unknown plan', () => {
    expect(getPlanById('unknown')).toBeNull();
  });

  it('should get all plans', () => {
    const plans = getAllPlans();

    expect(plans.length).toBe(3);
    expect(plans).toContain(STARTER_PLAN);
    expect(plans).toContain(PRO_PLAN);
    expect(plans).toContain(ENTERPRISE_PLAN);
  });
});

describe('Feature Gating', () => {
  it('should allow basic features for starter plan', () => {
    expect(canAccessFeature('starter', 'basic_budgeting')).toBe(true);
    expect(canAccessFeature('starter', 'dashboard')).toBe(true);
    expect(canAccessFeature('starter', 'email_support')).toBe(true);
  });

  it('should deny advanced features for starter plan', () => {
    expect(canAccessFeature('starter', 'advanced_analytics')).toBe(false);
    expect(canAccessFeature('starter', 'api_access')).toBe(false);
    expect(canAccessFeature('starter', 'custom_integrations')).toBe(false);
  });

  it('should allow pro features', () => {
    expect(canAccessFeature('pro', 'advanced_analytics')).toBe(true);
    expect(canAccessFeature('pro', 'api_access')).toBe(true);
    expect(canAccessFeature('pro', 'priority_support')).toBe(true);
  });

  it('should deny enterprise-only features for pro plan', () => {
    expect(canAccessFeature('pro', 'custom_integrations')).toBe(false);
    expect(canAccessFeature('pro', 'white_label')).toBe(false);
    expect(canAccessFeature('pro', 'sla_guarantee')).toBe(false);
  });

  it('should allow all features for enterprise plan', () => {
    expect(canAccessFeature('enterprise', 'basic_budgeting')).toBe(true);
    expect(canAccessFeature('enterprise', 'advanced_analytics')).toBe(true);
    expect(canAccessFeature('enterprise', 'custom_integrations')).toBe(true);
    expect(canAccessFeature('enterprise', 'white_label')).toBe(true);
  });

  it('should return false for invalid plan', () => {
    expect(canAccessFeature('unknown', 'any_feature')).toBe(false);
  });

  it('should get available features for plan', () => {
    const starterFeatures = getAvailableFeatures('starter');

    expect(starterFeatures.length).toBeGreaterThan(0);
    expect(starterFeatures).toContain('basic_budgeting');
    expect(starterFeatures).toContain('dashboard');
  });

  it('should return empty array for invalid plan', () => {
    expect(getAvailableFeatures('unknown')).toEqual([]);
  });

  it('should check if feature available in plan', () => {
    expect(isFeatureAvailableInPlan('api_access', 'pro')).toBe(true);
    expect(isFeatureAvailableInPlan('api_access', 'starter')).toBe(false);
  });

  it('should get plans that include feature', () => {
    const dashboardPlans = getPlansThatIncludeFeature('dashboard');

    expect(dashboardPlans.length).toBe(3);
    expect(dashboardPlans).toContain('starter');
    expect(dashboardPlans).toContain('pro');
    expect(dashboardPlans).toContain('enterprise');
  });

  it('should return plans for advanced features', () => {
    const analyticsPlans = getPlansThatIncludeFeature('advanced_analytics');

    expect(analyticsPlans.length).toBe(2);
    expect(analyticsPlans).toContain('pro');
    expect(analyticsPlans).toContain('enterprise');
    expect(analyticsPlans).not.toContain('starter');
  });

  it('should return empty array for non-existent feature', () => {
    expect(getPlansThatIncludeFeature('non_existent_feature')).toEqual([]);
  });
});
