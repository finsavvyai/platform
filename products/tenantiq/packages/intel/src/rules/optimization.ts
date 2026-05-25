import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS, LICENSE_COSTS } from '@tenantiq/shared';

/**
 * OPT-001: Inactive users (30/60/90 days).
 */
const inactiveUsers: Rule = {
	id: RULE_IDS.OPT_001,
	name: 'Inactive users detected',
	severity: 'high',
	category: 'optimization',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const alerts: AlertCandidate[] = [];
		const now = Date.now();
		const thirtyDays = 30 * 24 * 60 * 60 * 1000;

		const inactiveUsers = data.users.filter((user) => {
			if (!user.accountEnabled) return false;
			if (!user.lastSignIn) return true; // Never signed in
			const lastSignIn = new Date(user.lastSignIn).getTime();
			return now - lastSignIn > thirtyDays;
		});

		if (inactiveUsers.length > 0) {
			// Calculate cost impact
			const monthlyCost = inactiveUsers.reduce((sum, user) => {
				const licenses = user.assignedLicenses ?? [];
				const cost = licenses.reduce((s, lic) => s + (LICENSE_COSTS[lic] ?? 0), 0);
				return sum + cost;
			}, 0);

			alerts.push({
				ruleId: RULE_IDS.OPT_001,
				title: `${inactiveUsers.length} inactive users detected`,
				description: `Found ${inactiveUsers.length} users who haven't signed in for 30+ days but still have active licenses.`,
				businessImpact: monthlyCost > 0 ? `$${Math.round(monthlyCost).toLocaleString()}/month in wasted licenses` : null,
				affectedResources: inactiveUsers.map((u) => ({ id: u.azureUserId, name: u.displayName, email: u.email })),
				recommendedAction: 'Review inactive users and consider decommissioning or downgrading their licenses.'
			});
		}

		return alerts;
	}
};

/**
 * OPT-002: Underutilized E5 licenses.
 */
const underutilizedE5: Rule = {
	id: RULE_IDS.OPT_002,
	name: 'Underutilized premium licenses',
	severity: 'high',
	category: 'optimization',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const alerts: AlertCandidate[] = [];

		// Find E5 license SKU info
		const e5Sku = data.licenses.find(
			(l) => l.skuName.includes('E5') || l.skuName.includes('Microsoft 365 E5')
		);
		if (!e5Sku || e5Sku.assigned === 0) return alerts;

		// Identify E5-licensed users who haven't signed in recently (30+ days)
		// These users are likely not utilizing premium E5 features
		const now = Date.now();
		const thirtyDays = 30 * 24 * 60 * 60 * 1000;

		const underutilized = data.users.filter((user) => {
			if (!user.accountEnabled) return false;
			// Check if user has E5 license
			const hasE5 = user.assignedLicenses?.some(
				(lic) => lic.includes('E5') || lic === e5Sku.skuId
			);
			if (!hasE5) return false;

			// Check for low activity via non-interactive sign-in (proxy for service usage)
			// If no non-interactive sign-in in 30 days, they're likely only using email
			if (!user.lastNonInteractiveSignIn) return true;
			const lastActivity = new Date(user.lastNonInteractiveSignIn).getTime();
			return now - lastActivity > thirtyDays;
		});

		if (underutilized.length > 0) {
			const e5Cost = LICENSE_COSTS['Microsoft 365 E5'] ?? 57;
			const e3Cost = LICENSE_COSTS['Microsoft 365 E3'] ?? 36;
			const savingsPerUser = e5Cost - e3Cost;
			const totalSavings = underutilized.length * savingsPerUser;

			alerts.push({
				ruleId: RULE_IDS.OPT_002,
				title: `${underutilized.length} users have underutilized E5 licenses`,
				description: `These users have premium E5 licenses but show minimal advanced feature usage. Consider downgrading to E3.`,
				businessImpact: `$${Math.round(totalSavings).toLocaleString()}/month potential savings by downgrading to E3`,
				affectedResources: underutilized.map((u) => ({
					id: u.azureUserId,
					name: u.displayName,
					email: u.email,
					currentLicense: 'E5',
					suggestedLicense: 'E3'
				})),
				recommendedAction: 'Review these users and downgrade from E5 to E3 if they do not use advanced security, compliance, or analytics features.'
			});
		}

		return alerts;
	}
};

/**
 * OPT-003: Unassigned licenses.
 */
const unassignedLicenses: Rule = {
	id: RULE_IDS.OPT_003,
	name: 'Unassigned licenses wasting budget',
	severity: 'medium',
	category: 'optimization',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const alerts: AlertCandidate[] = [];

		const unassigned = data.licenses.filter((lic) => lic.total > lic.assigned);
		const totalWaste = unassigned.reduce((sum, lic) => {
			const unused = lic.total - lic.assigned;
			return sum + unused * (lic.costPerUnit ?? 0);
		}, 0);

		if (totalWaste > 0) {
			alerts.push({
				ruleId: RULE_IDS.OPT_003,
				title: `${unassigned.length} license SKUs have unassigned seats`,
				description: `You're paying for licenses that aren't assigned to any user.`,
				businessImpact: `$${Math.round(totalWaste).toLocaleString()}/month in unused licenses`,
				affectedResources: unassigned.map((l) => ({
					skuName: l.skuName,
					unused: l.total - l.assigned,
					monthlyCost: (l.total - l.assigned) * (l.costPerUnit ?? 0)
				})),
				recommendedAction: 'Reduce license quantities to match actual needs, or assign unused licenses to users who need them.'
			});
		}

		return alerts;
	}
};

export const optimizationRules: Rule[] = [inactiveUsers, underutilizedE5, unassignedLicenses];
