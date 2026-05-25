/**
 * Microsoft Commercial Marketplace plan definitions and helpers.
 * Maps AppSource plan IDs to TenantIQ billing tiers.
 */

export interface MarketplacePlan {
	readonly name: string;
	readonly price: number;
	readonly billingPlan: string;
	readonly features: readonly string[];
}

export const MARKETPLACE_PLANS: Record<string, MarketplacePlan> = {
	'tenantiq-core': {
		name: 'Core',
		price: 79,
		billingPlan: 'core',
		features: [
			'1 tenant',
			'CIS benchmark scanning',
			'Email security analysis',
			'Basic anomaly detection',
		],
	},
	'tenantiq-professional': {
		name: 'Professional',
		price: 79,
		billingPlan: 'professional',
		features: [
			'Up to 10 tenants',
			'All Starter features',
			'AI-powered insights',
			'User lifecycle workflows',
			'Skill marketplace',
		],
	},
	'tenantiq-enterprise': {
		name: 'Enterprise',
		price: 149,
		billingPlan: 'enterprise',
		features: [
			'Unlimited tenants',
			'All Professional features',
			'SSO / SAML',
			'Custom compliance frameworks',
			'Priority support',
			'Dedicated onboarding',
		],
	},
} as const;

export type MarketplaceAction =
	| 'ChangePlan'
	| 'ChangeQuantity'
	| 'Suspend'
	| 'Unsubscribe'
	| 'Reinstate'
	| 'Renew';

const ACTION_STATUS_MAP: Record<string, string> = {
	ChangePlan: 'active',
	ChangeQuantity: 'active',
	Suspend: 'suspended',
	Unsubscribe: 'cancelled',
	Reinstate: 'active',
	Renew: 'active',
};

export function resolveMarketplacePlan(
	planId: string,
): MarketplacePlan | null {
	return MARKETPLACE_PLANS[planId] ?? null;
}

export function mapSubscriptionStatus(action: string): string {
	return ACTION_STATUS_MAP[action] ?? 'unknown';
}

export function isValidAction(action: string): action is MarketplaceAction {
	return action in ACTION_STATUS_MAP;
}
