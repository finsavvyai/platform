import type { Plan } from '../types/user.js';

export interface PlanConfig {
  name: string;
  price: number; // monthly in cents
  instanceLimit: number;
  verifiedSkillLimit: number | null; // null = unlimited
  allowUnverifiedSkills: boolean;
  auditLogRetentionDays: number;
  securityDashboard: 'basic' | 'full' | 'full+audit';
  supportLevel: 'community' | 'email' | 'priority';
  agentLimit: number;
  agentHistoryDays: number;
  cloudSync: boolean;
  teamDashboard: boolean;
  policyEngine: boolean;
  pdfReports: boolean;
  cspmAccounts: number;
}

/** @deprecated Legacy configs kept for backward compatibility with existing subscriptions */
const LEGACY_CONFIGS = {
  personal: {
    name: 'Personal', price: 4900, instanceLimit: 1, verifiedSkillLimit: 10,
    allowUnverifiedSkills: false, auditLogRetentionDays: 7, securityDashboard: 'basic' as const,
    supportLevel: 'community' as const, agentLimit: 3, agentHistoryDays: 30,
    cloudSync: false, teamDashboard: false, policyEngine: false, pdfReports: false, cspmAccounts: 0,
  },
  pro: {
    name: 'Pro', price: 14900, instanceLimit: 1, verifiedSkillLimit: null,
    allowUnverifiedSkills: true, auditLogRetentionDays: 90, securityDashboard: 'full' as const,
    supportLevel: 'email' as const, agentLimit: 10, agentHistoryDays: 90,
    cloudSync: true, teamDashboard: false, policyEngine: true, pdfReports: false, cspmAccounts: 3,
  },
};

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  free: {
    name: 'Free', price: 0, instanceLimit: 1, verifiedSkillLimit: 3,
    allowUnverifiedSkills: false, auditLogRetentionDays: 3, securityDashboard: 'basic',
    supportLevel: 'community', agentLimit: 1, agentHistoryDays: 7,
    cloudSync: false, teamDashboard: false, policyEngine: false, pdfReports: false, cspmAccounts: 0,
  },
  personal: LEGACY_CONFIGS.personal,
  pro: LEGACY_CONFIGS.pro,
  team: {
    name: 'Team', price: 29900, instanceLimit: 3, verifiedSkillLimit: null,
    allowUnverifiedSkills: true, auditLogRetentionDays: 90, securityDashboard: 'full',
    supportLevel: 'email', agentLimit: 3, agentHistoryDays: 90,
    cloudSync: true, teamDashboard: true, policyEngine: true, pdfReports: false, cspmAccounts: 5,
  },
  professional: {
    name: 'Professional', price: 79900, instanceLimit: 10, verifiedSkillLimit: null,
    allowUnverifiedSkills: true, auditLogRetentionDays: 365, securityDashboard: 'full+audit',
    supportLevel: 'priority', agentLimit: 10, agentHistoryDays: 365,
    cloudSync: true, teamDashboard: true, policyEngine: true, pdfReports: true, cspmAccounts: 20,
  },
  enterprise: {
    name: 'Enterprise', price: 249900, instanceLimit: -1, verifiedSkillLimit: null,
    allowUnverifiedSkills: true, auditLogRetentionDays: 1825, securityDashboard: 'full+audit',
    supportLevel: 'priority', agentLimit: -1, agentHistoryDays: 1825,
    cloudSync: true, teamDashboard: true, policyEngine: true, pdfReports: true, cspmAccounts: -1,
  },
  mission_defender: {
    name: 'Mission Defender', price: 999900, instanceLimit: -1, verifiedSkillLimit: null,
    allowUnverifiedSkills: true, auditLogRetentionDays: 1825, securityDashboard: 'full+audit',
    supportLevel: 'priority', agentLimit: -1, agentHistoryDays: 1825,
    cloudSync: true, teamDashboard: true, policyEngine: true, pdfReports: true, cspmAccounts: -1,
  },
};

/** Numeric rank for each plan, used to pick the higher plan. */
export const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  personal: 1,
  pro: 2,
  team: 3,
  professional: 4,
  enterprise: 5,
  mission_defender: 6,
};

/** Return the higher of two plans based on rank. */
export function higherPlan(a: Plan, b: Plan): Plan {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

export const FREE_TRIAL_DAYS = 7;

/**
 * LemonSqueezy product/variant configuration
 * All prefixed with OPENSYBER_ since the store is shared across products
 *
 * Environment variables to set:
 *   OPENSYBER_LS_PRODUCT_ID                - LemonSqueezy product ID for OpenSyber
 *   OPENSYBER_LS_VARIANT_TEAM              - Variant ID for Team plan ($299/mo)
 *   OPENSYBER_LS_VARIANT_PROFESSIONAL      - Variant ID for Professional plan ($799/mo)
 */
export const LEMONSQUEEZY_ENV_KEYS = {
  productId: 'OPENSYBER_LS_PRODUCT_ID',
  variantTeam: 'OPENSYBER_LS_VARIANT_TEAM',
  variantProfessional: 'OPENSYBER_LS_VARIANT_PROFESSIONAL',
  /** @deprecated Legacy variants kept for existing subscriptions */
  variantPersonal: 'OPENSYBER_LS_VARIANT_PERSONAL',
  variantPro: 'OPENSYBER_LS_VARIANT_PRO',
} as const;
