import { z } from 'zod';

/**
 * Subscription Tiers — Boutique 4-tier pricing.
 * Prices in cents (USD). All per-tenant/month.
 */
export const SUBSCRIPTION_TIERS = {
	core: {
		name: 'Core',
		monthlyPrice: 7900,   // $79/month
		annualPrice: 75600,   // $756/year ($63/mo — save 20%)
		maxTenants: 5,
		maxUsers: 100,
		maxScansPerMonth: 200,
		maxAlerts: 2000,
		maxStorageGB: 10,
		features: ['cis_monitoring', 'security_dashboard', 'alerts', 'license_reports', 'email_support'],
	},
	professional: {
		name: 'Professional',
		monthlyPrice: 19900,  // $199/month
		annualPrice: 190800,  // $1,908/year ($159/mo — save 20%)
		maxTenants: 25,
		maxUsers: 500,
		maxScansPerMonth: 1000,
		maxAlerts: 10000,
		maxStorageGB: 50,
		features: [
			'everything_in_core', 'ai_agent', 'auto_remediation', 'compliance_reports',
			'workflow_automation', 'license_optimization', 'priority_support',
		],
	},
	security_suite: {
		name: 'Security Suite',
		monthlyPrice: 39900,  // $399/month
		annualPrice: 382800,  // $3,828/year ($319/mo — save 20%)
		maxTenants: 50,
		maxUsers: 2000,
		maxScansPerMonth: 5000,
		maxAlerts: 50000,
		maxStorageGB: 200,
		features: [
			'everything_in_professional', 'security_hardening', 'drift_monitoring',
			'security_stack_config', 'tokenforge_integration', 'config_snapshots',
			'advanced_reporting', 'dedicated_support',
		],
	},
	enterprise: {
		name: 'Enterprise',
		monthlyPrice: 0,      // Custom pricing
		annualPrice: 0,
		maxTenants: 10000,
		maxUsers: 50000,
		maxScansPerMonth: 50000,
		maxAlerts: 500000,
		maxStorageGB: 2000,
		features: [
			'everything_in_security_suite', 'sso_saml', 'white_label',
			'custom_integrations', 'sla_guarantee', 'dedicated_csm',
			'data_residency', 'training',
		],
	},
};

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export const createSubscriptionSchema = z.object({
	organizationId: z.string(),
	tier: z.enum(['core', 'professional', 'security_suite', 'enterprise']),
	billingInterval: z.enum(['monthly', 'annual']).default('monthly'),
	customPrice: z.number().optional(),
	startDate: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
	tier: z.enum(['core', 'professional', 'security_suite', 'enterprise']).optional(),
	status: z.enum(['trial', 'active', 'past_due', 'cancelled', 'expired']).optional(),
	billingInterval: z.enum(['monthly', 'annual']).optional(),
	cancelAtPeriodEnd: z.boolean().optional(),
});
