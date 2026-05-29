/**
 * Subscription Management — feature keys and default plan definitions
 */

import type { SubscriptionPlan } from './subscriptionTypes';

export const SUBSCRIPTION_FEATURES = {
  AI_QUERIES: 'ai_queries',
  VOICE: 'voice',
  CODE_GENERATION: 'code_generation',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_BRANDING: 'custom_branding',
  API_ACCESS: 'api_access',
  SSO: 'sso',
  UNLIMITED_TEAMS: 'unlimited_teams',
  UNLIMITED_MEMBERS: 'unlimited_members',
  UNLIMITED_CONNECTIONS: 'unlimited_connections',
  UNLIMITED_QUERIES: 'unlimited_queries',
  UNLIMITED_STORAGE: 'unlimited_storage',
} as const;

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'free', name: 'Free', description: 'Perfect for personal projects',
    price: 0, currency: 'USD', interval: 'month', trialDays: 0,
    lemonSqueezyVariantId: 'free_variant_id', lemonSqueezyProductId: 'product_id',
    features: { maxTeams: 1, maxMembersPerTeam: 1, maxConnections: 3, maxQueriesPerMonth: 1000, maxStorageGB: 1, aiQueriesEnabled: false, voiceEnabled: false, codeGeneration: false, advancedAnalytics: false, prioritySupport: false, customBranding: false, apiAccess: false, ssoEnabled: false, auditLogRetention: 30 },
  },
  {
    id: 'pro', name: 'Pro', description: 'For professional developers',
    price: 2900, currency: 'USD', interval: 'month', trialDays: 14,
    lemonSqueezyVariantId: 'pro_variant_id', lemonSqueezyProductId: 'product_id',
    features: { maxTeams: 5, maxMembersPerTeam: 10, maxConnections: 25, maxQueriesPerMonth: 50000, maxStorageGB: 50, aiQueriesEnabled: true, voiceEnabled: true, codeGeneration: true, advancedAnalytics: true, prioritySupport: false, customBranding: false, apiAccess: true, ssoEnabled: false, auditLogRetention: 90 },
  },
  {
    id: 'business', name: 'Business', description: 'For growing teams',
    price: 9900, currency: 'USD', interval: 'month', trialDays: 14,
    lemonSqueezyVariantId: 'business_variant_id', lemonSqueezyProductId: 'product_id',
    features: { maxTeams: 25, maxMembersPerTeam: 50, maxConnections: 100, maxQueriesPerMonth: 250000, maxStorageGB: 500, aiQueriesEnabled: true, voiceEnabled: true, codeGeneration: true, advancedAnalytics: true, prioritySupport: true, customBranding: true, apiAccess: true, ssoEnabled: true, auditLogRetention: 365 },
  },
  {
    id: 'enterprise', name: 'Enterprise', description: 'For large organizations',
    price: 29900, currency: 'USD', interval: 'month', trialDays: 30,
    lemonSqueezyVariantId: 'enterprise_variant_id', lemonSqueezyProductId: 'product_id',
    features: { maxTeams: -1, maxMembersPerTeam: -1, maxConnections: -1, maxQueriesPerMonth: -1, maxStorageGB: -1, aiQueriesEnabled: true, voiceEnabled: true, codeGeneration: true, advancedAnalytics: true, prioritySupport: true, customBranding: true, apiAccess: true, ssoEnabled: true, auditLogRetention: -1 },
  },
];
