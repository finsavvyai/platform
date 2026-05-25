/**
 * OPT-007: Unused Microsoft Teams Licenses
 * Detects users with Teams licenses who never use Teams
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { LicenseUser, TeamsActivityEntry } from './advanced-optimization-types.js';
import { estimateLicenseCost } from './advanced-optimization-types.js';

export const unusedTeamsLicenses: Rule = {
	id: 'OPT-007',
	name: 'Unused Microsoft Teams licenses',
	severity: 'medium',
	category: 'optimization',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const teamsActivity = ((data as any).teamsActivity ?? []) as TeamsActivityEntry[];
		const users = (data.users ?? []) as unknown as LicenseUser[];

		const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);

		const unusedTeamsUsers: Array<{
			email: string;
			name: string;
			licenseType: string;
			lastActivity: string;
			monthlyCost: number;
		}> = [];

		users.forEach(user => {
			const hasTeamsLicense = user.assignedLicenses?.some(l =>
				l.skuName.includes('Teams') || l.skuName.includes('E3') || l.skuName.includes('E5')
			);

			if (!hasTeamsLicense) return;

			const activity = teamsActivity.find(a => a.userEmail === user.userPrincipalName);

			if (!activity || !activity.lastActivityDate ||
				new Date(activity.lastActivityDate).getTime() < ninetyDaysAgo) {

				const licenseType = user.assignedLicenses?.find(l =>
					l.skuName.includes('Teams') || l.skuName.includes('E3') || l.skuName.includes('E5')
				)?.skuName || 'Unknown';

				unusedTeamsUsers.push({
					email: user.userPrincipalName,
					name: user.displayName,
					licenseType,
					lastActivity: activity?.lastActivityDate || 'Never',
					monthlyCost: estimateLicenseCost(licenseType)
				});
			}
		});

		if (unusedTeamsUsers.length === 0) return [];

		const totalSavings = unusedTeamsUsers.reduce((sum, u) => sum + u.monthlyCost, 0);

		return [{
			ruleId: 'OPT-007',
			title: `${unusedTeamsUsers.length} user(s) not using Microsoft Teams`,
			description: 'Users have licenses that include Teams but show no Teams activity in 90+ days.',
			businessImpact: `Medium: Wasting $${totalSavings.toFixed(2)}/month on unused Teams licenses`,
			affectedResources: unusedTeamsUsers.map(u => ({
				type: 'user',
				email: u.email,
				name: u.name,
				licenseType: u.licenseType,
				lastActivity: u.lastActivity,
				monthlySavings: u.monthlyCost
			})),
			recommendedAction: 'Consider downgrading to licenses without Teams or encourage Teams adoption.'
		}];
	}
};
