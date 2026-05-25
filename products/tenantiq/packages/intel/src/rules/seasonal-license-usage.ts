/**
 * OPT-005: Seasonal License Usage Patterns
 * Detects seasonal workers or contractors who don't need year-round licenses
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { SeasonalUser, SignInEntry } from './advanced-optimization-types.js';

export const seasonalLicenseUsage: Rule = {
	id: 'OPT-005',
	name: 'Seasonal license usage patterns detected',
	severity: 'low',
	category: 'optimization',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const users = (data.users ?? []) as unknown as SeasonalUser[];
		const signInHistory = (data.signInLogs ?? []) as SignInEntry[];

		const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
		const recentHistory = signInHistory.filter(s =>
			new Date(s.createdDateTime).getTime() > sixMonthsAgo
		);

		const userActivityByMonth = new Map<string, Set<number>>();

		recentHistory.forEach(signIn => {
			const month = new Date(signIn.createdDateTime).getMonth();
			const existing = userActivityByMonth.get(signIn.userPrincipalName) || new Set();
			existing.add(month);
			userActivityByMonth.set(signIn.userPrincipalName, existing);
		});

		const seasonalUsers: Array<{
			email: string;
			name: string;
			activeMonths: number;
			inactiveMonths: number;
			potentialSavings: number;
		}> = [];

		userActivityByMonth.forEach((months, userEmail) => {
			const user = users.find(u => u.userPrincipalName === userEmail);
			if (!user || !user.assignedLicenses || user.assignedLicenses.length === 0) return;

			if (months.size <= 3 && months.size > 0) {
				const licenseCount = user.assignedLicenses.length;
				const avgCost = licenseCount * 30;
				const inactiveMonths = 6 - months.size;
				const potentialSavings = avgCost * inactiveMonths;

				seasonalUsers.push({
					email: userEmail,
					name: user.displayName,
					activeMonths: months.size,
					inactiveMonths,
					potentialSavings
				});
			}
		});

		if (seasonalUsers.length === 0) return [];

		const totalSavings = seasonalUsers.reduce((sum, u) => sum + u.potentialSavings, 0);

		return [{
			ruleId: 'OPT-005',
			title: `${seasonalUsers.length} user(s) with seasonal usage patterns`,
			description: 'Detected users with intermittent activity who may not need year-round licenses.',
			businessImpact: `Low: Potential savings of $${totalSavings.toFixed(2)} by using pay-as-you-go licensing`,
			affectedResources: seasonalUsers.map(u => ({
				type: 'user',
				email: u.email,
				name: u.name,
				activeMonths: u.activeMonths,
				inactiveMonths: u.inactiveMonths,
				potentialSavings: u.potentialSavings
			})),
			recommendedAction: 'Consider flexible licensing for seasonal workers or contractors.'
		}];
	}
};
