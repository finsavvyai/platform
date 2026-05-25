/**
 * OPT-004: Duplicate License Assignments
 * Detects users with redundant license assignments
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { LicenseUser } from './advanced-optimization-types.js';
import { REDUNDANT_LICENSE_COMBOS } from './advanced-optimization-types.js';

export const duplicateLicenses: Rule = {
	id: 'OPT-004',
	name: 'Duplicate or redundant license assignments',
	severity: 'medium',
	category: 'optimization',
	remediationType: 'automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const users = (data.users ?? []) as unknown as LicenseUser[];

		const usersWithDuplicates: Array<{
			email: string;
			name: string;
			redundantLicenses: string[];
			monthlyCost: number;
		}> = [];

		users.forEach(user => {
			if (!user.assignedLicenses || user.assignedLicenses.length < 2) return;

			const userLicenses = user.assignedLicenses.map(l => l.skuName);

			REDUNDANT_LICENSE_COMBOS.forEach(([lic1, lic2]) => {
				if (userLicenses.includes(lic1) && userLicenses.includes(lic2)) {
					const cost = lic2.includes('E5') ? 57 : lic2.includes('E3') ? 36 : 20;

					usersWithDuplicates.push({
						email: user.userPrincipalName,
						name: user.displayName,
						redundantLicenses: [lic1, lic2],
						monthlyCost: cost
					});
				}
			});
		});

		if (usersWithDuplicates.length === 0) return [];

		const totalSavings = usersWithDuplicates.reduce((sum, u) => sum + u.monthlyCost, 0);

		return [{
			ruleId: 'OPT-004',
			title: `${usersWithDuplicates.length} user(s) with redundant license assignments`,
			description: 'Detected users assigned multiple licenses where one includes the functionality of another.',
			businessImpact: `Medium: Wasting $${totalSavings.toFixed(2)}/month ($${(totalSavings * 12).toFixed(2)}/year)`,
			affectedResources: usersWithDuplicates.map(u => ({
				type: 'user',
				email: u.email,
				name: u.name,
				redundantLicenses: u.redundantLicenses,
				monthlySavings: u.monthlyCost
			})),
			recommendedAction: 'Remove redundant licenses to reduce costs without affecting functionality.'
		}];
	}
};
