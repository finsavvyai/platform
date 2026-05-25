import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';

const mfaNotEnforced: Rule = {
	id: RULE_IDS.SEC_001,
	name: 'MFA not enforced for admins',
	severity: 'critical',
	category: 'security',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const policies = (data.conditionalAccessPolicies ?? []) as Array<{
			displayName: string;
			state: string;
			conditions?: { users?: { includeRoles?: string[] } };
			grantControls?: { builtInControls?: string[] };
		}>;

		const mfaPolicies = policies.filter(
			(p) => p.state === 'enabled' && p.grantControls?.builtInControls?.includes('mfa')
		);

		const coversAdmins = mfaPolicies.some((p) =>
			p.conditions?.users?.includeRoles?.includes('All') ||
			(p.conditions?.users?.includeRoles?.length ?? 0) > 0
		);

		if (!coversAdmins && policies.length > 0) {
			return [{
				ruleId: RULE_IDS.SEC_001,
				title: 'MFA not enforced for admin accounts',
				description: 'No conditional access policy enforces MFA for users with admin roles.',
				businessImpact: 'Critical: admin accounts without MFA are vulnerable to credential attacks',
				affectedResources: [{ type: 'policy', description: 'Missing MFA enforcement for admin roles' }],
				recommendedAction: 'Create or update a conditional access policy to require MFA for all admin role assignments.'
			}];
		}
		return [];
	}
};

const legacyAuthEnabled: Rule = {
	id: RULE_IDS.SEC_002,
	name: 'Legacy authentication enabled',
	severity: 'critical',
	category: 'security',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const policies = (data.conditionalAccessPolicies ?? []) as Array<{
			state: string;
			conditions?: { clientAppTypes?: string[] };
			grantControls?: { builtInControls?: string[] };
		}>;

		const blocksLegacy = policies.some(
			(p) =>
				p.state === 'enabled' &&
				p.conditions?.clientAppTypes?.includes('exchangeActiveSync') &&
				p.grantControls?.builtInControls?.includes('block')
		);

		if (!blocksLegacy && policies.length > 0) {
			return [{
				ruleId: RULE_IDS.SEC_002,
				title: 'Legacy authentication protocols still enabled',
				description: 'No conditional access policy blocks legacy authentication protocols.',
				businessImpact: 'Legacy auth bypasses MFA and is the primary vector for password spray attacks',
				affectedResources: [{ type: 'policy', description: 'No policy blocking legacy auth' }],
				recommendedAction: 'Create a conditional access policy to block legacy authentication protocols.'
			}];
		}
		return [];
	}
};

const externalSharingOvershare: Rule = {
	id: RULE_IDS.SEC_006,
	name: 'External sharing overshare detected',
	severity: 'medium',
	category: 'security',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const guests = data.users.filter((u) => u.userType === 'guest');
		const total = data.users.length;
		const ratio = total > 0 ? guests.length / total : 0;

		if (ratio > 0.3 && guests.length > 20) {
			return [{
				ruleId: RULE_IDS.SEC_006,
				title: `High guest user ratio: ${guests.length} guests (${Math.round(ratio * 100)}%)`,
				description: 'High proportion of external guest users detected.',
				businessImpact: 'Increased attack surface and data loss prevention risk',
				affectedResources: [{ guestCount: guests.length, totalUsers: total, ratio: `${Math.round(ratio * 100)}%` }],
				recommendedAction: 'Review guest access and tighten external sharing policies.'
			}];
		}
		return [];
	}
};

export const policyRules: Rule[] = [mfaNotEnforced, legacyAuthEnabled, externalSharingOvershare];
