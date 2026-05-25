/**
 * Tenant Provisioning Types & Configuration
 */

export interface ProvisionTenantParams {
	// Organization details
	organizationName: string;
	slug: string;
	domain?: string;

	// Primary contact (will become tenant admin)
	adminEmail: string;
	adminName: string;
	adminPassword?: string;

	// Contact information
	phone?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	zipCode?: string;
	country?: string;

	// Subscription
	subscriptionTier: 'core' | 'professional' | 'security_suite' | 'enterprise';
	billingInterval?: 'monthly' | 'annual';
	trialDays?: number;

	// Optional metadata
	industry?: string;
	companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
	websiteUrl?: string;

	// Platform admin who created this
	createdBy: string;
}

export interface ProvisionedTenant {
	organization: {
		id: string;
		name: string;
		slug: string;
		status: string;
	};
	adminUser: {
		id: string;
		email: string;
		name: string;
		role: string;
		status: string;
	};
	subscription: {
		id: string;
		tier: string;
		status: string;
		currentPeriodEnd: string;
	};
	invitation?: {
		token: string;
		expiresAt: string;
		invitationUrl: string;
	};
}

/**
 * Subscription tier configuration
 */
export const TIER_CONFIG = {
	core: {
		monthlyPrice: 7900,
		annualPrice: 75600,
		maxUsers: 50,
		maxScansPerMonth: 100,
		maxAlerts: 1000,
		maxStorageGB: 10,
		features: ['cis_benchmark', 'security_dashboard', 'license_reports', 'email_notifications', 'basic_compliance'],
	},
	professional: {
		monthlyPrice: 19900,
		annualPrice: 190800,
		maxUsers: 200,
		maxScansPerMonth: 500,
		maxAlerts: 5000,
		maxStorageGB: 50,
		features: ['ai_agent', 'auto_remediation', 'soc2_hipaa_gdpr', 'workflow_automation', 'license_optimization', 'priority_support'],
	},
	security_suite: {
		monthlyPrice: 39900,
		annualPrice: 382800,
		maxUsers: 500,
		maxScansPerMonth: 2000,
		maxAlerts: 20000,
		maxStorageGB: 200,
		features: ['hardening_wizard', 'drift_monitoring', 'security_stack_management', 'tokenforge', 'config_snapshots', 'executive_reporting', 'dedicated_engineer'],
	},
	enterprise: {
		monthlyPrice: 0,
		annualPrice: 0,
		maxUsers: 9999,
		maxScansPerMonth: 99999,
		maxAlerts: 999999,
		maxStorageGB: 5000,
		features: ['sso_saml_oidc', 'white_label', 'custom_integrations', 'sla_guarantee', 'dedicated_csm', 'data_residency', 'onboarding_training'],
	},
};
