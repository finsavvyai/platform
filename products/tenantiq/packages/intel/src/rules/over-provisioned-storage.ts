/**
 * OPT-006: Over-Provisioned Storage
 * Detects users with excessive OneDrive/SharePoint storage allocation
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { StorageEntry } from './advanced-optimization-types.js';

export const overProvisionedStorage: Rule = {
	id: 'OPT-006',
	name: 'Over-provisioned storage detected',
	severity: 'low',
	category: 'optimization',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const storage = ((data as any).storageUsage ?? []) as StorageEntry[];

		const underutilized = storage.filter(s => s.percentUsed < 10 && s.allocated > 100);

		if (underutilized.length === 0) return [];

		const totalWastedAllocation = underutilized.reduce((sum, s) =>
			sum + (s.allocated - s.used), 0
		);

		return [{
			ruleId: 'OPT-006',
			title: `${underutilized.length} user(s) with over-provisioned storage`,
			description: 'Users have significantly more storage allocated than they are using.',
			businessImpact: `Low: ${totalWastedAllocation.toFixed(0)} GB of unused storage allocation`,
			affectedResources: underutilized.map(s => ({
				type: 'storage',
				userEmail: s.userEmail,
				allocatedGB: s.allocated,
				usedGB: s.used,
				percentUsed: s.percentUsed
			})),
			recommendedAction: 'Review storage allocations and reduce limits for users who don\'t need them.'
		}];
	}
};
