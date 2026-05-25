import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const downgradeLicense: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_004,
	name: 'Downgrade License',
	description: 'Removes the current premium license and assigns a lower-tier license to the user.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const users = resources as Array<{
			id: string;
			name?: string;
			currentSkuId: string;
			targetSkuId: string;
		}>;

		const beforeState: unknown[] = [];
		const afterState: unknown[] = [];

		for (const user of users) {
			try {
				// Get current license assignment
				const current = await graphClient.request<{ assignedLicenses: Array<{ skuId: string }> }>(
					tenantId, `/users/${user.id}?$select=assignedLicenses`
				);
				beforeState.push({ userId: user.id, licenses: current.assignedLicenses });

				// Swap: remove old, add new
				await graphClient.request(tenantId, `/users/${user.id}/assignLicense`, {
					method: 'POST',
					body: JSON.stringify({
						addLicenses: [{ skuId: user.targetSkuId, disabledPlans: [] }],
						removeLicenses: [user.currentSkuId]
					})
				});

				afterState.push({ userId: user.id, removedSku: user.currentSkuId, addedSku: user.targetSkuId });
			} catch (err) {
				return { success: false, beforeState, afterState, error: `Failed for user ${user.id}: ${err}` };
			}
		}

		return { success: true, beforeState, afterState };
	},

	async dryRun(tenantId: string, resources: unknown[], _graphClient: GraphClient): Promise<DryRunResult> {
		const users = resources as Array<{ id: string; name?: string; currentSkuId: string; targetSkuId: string }>;
		return {
			changes: users.map((u) => ({
				resource: `User: ${u.name ?? u.id}`,
				action: 'Downgrade license',
				currentState: { skuId: u.currentSkuId },
				newState: { skuId: u.targetSkuId }
			}))
		};
	}
};
