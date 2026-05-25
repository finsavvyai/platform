import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';

const staleGuestUsers: Rule = {
	id: RULE_IDS.CMP_001,
	name: 'Stale guest users',
	severity: 'medium',
	category: 'compliance',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const now = Date.now();
		const ninetyDays = 90 * 24 * 60 * 60 * 1000;

		const staleGuests = data.users.filter((user) => {
			if (user.userType !== 'guest') return false;
			if (!user.lastSignIn) return true;
			return now - new Date(user.lastSignIn).getTime() > ninetyDays;
		});

		if (staleGuests.length > 0) {
			return [{
				ruleId: RULE_IDS.CMP_001,
				title: `${staleGuests.length} stale guest users`,
				description: `Found ${staleGuests.length} guest users with no activity in 90+ days.`,
				businessImpact: 'Increased security risk from dormant external access',
				affectedResources: staleGuests.map((u) => ({ id: u.azureUserId, name: u.displayName, email: u.email })),
				recommendedAction: 'Review and remove guest users who no longer need access.'
			}];
		}
		return [];
	}
};

const groupsWithoutOwners: Rule = {
	id: RULE_IDS.CMP_002,
	name: 'Groups without owners',
	severity: 'medium',
	category: 'compliance',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const groups = (data.groups ?? []) as Array<{ id: string; displayName: string; owners?: unknown[] }>;
		const orphaned = groups.filter((g) => !g.owners || g.owners.length === 0);

		if (orphaned.length > 0) {
			return [{
				ruleId: RULE_IDS.CMP_002,
				title: `${orphaned.length} groups without owners`,
				description: `Found ${orphaned.length} groups with no assigned owners.`,
				businessImpact: 'Compliance risk: unmanaged groups may violate access review policies',
				affectedResources: orphaned.map((g) => ({ id: g.id, name: g.displayName })),
				recommendedAction: 'Assign owners to orphaned groups or remove unneeded groups.'
			}];
		}
		return [];
	}
};

const disabledConditionalAccess: Rule = {
	id: RULE_IDS.CMP_003,
	name: 'Conditional access policy disabled',
	severity: 'high',
	category: 'compliance',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const policies = (data.conditionalAccessPolicies ?? []) as Array<{ id: string; displayName: string; state: string }>;
		const disabled = policies.filter((p) => p.state === 'disabled' || p.state === 'enabledForReportingButNotEnforced');

		if (disabled.length > 0) {
			return [{
				ruleId: RULE_IDS.CMP_003,
				title: `${disabled.length} conditional access policies disabled`,
				description: `Found ${disabled.length} policies not actively enforcing.`,
				businessImpact: 'Security controls not enforced. Potential compliance gap.',
				affectedResources: disabled.map((p) => ({ id: p.id, name: p.displayName, state: p.state })),
				recommendedAction: 'Review and enable policies that should be active.'
			}];
		}
		return [];
	}
};

export const complianceRules: Rule[] = [staleGuestUsers, groupsWithoutOwners, disabledConditionalAccess];
