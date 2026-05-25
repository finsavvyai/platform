import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const decommissionUser: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_001,
	name: 'Decommission User',
	description: 'Disables the user account, revokes all active sessions, and removes assigned licenses.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const users = resources as Array<{ id: string; name?: string; email?: string }>;
		const beforeState: unknown[] = [];
		const afterState: unknown[] = [];

		for (const user of users) {
			try {
				// Capture before state
				const current = await graphClient.request<{ accountEnabled: boolean; assignedLicenses: unknown[] }>(
					tenantId, `/users/${user.id}?$select=accountEnabled,assignedLicenses`
				);
				beforeState.push({ userId: user.id, ...current });

				// 1. Disable account
				await graphClient.request(tenantId, `/users/${user.id}`, {
					method: 'PATCH',
					body: JSON.stringify({ accountEnabled: false })
				});

				// 2. Revoke sessions
				await graphClient.request(tenantId, `/users/${user.id}/revokeSignInSessions`, {
					method: 'POST'
				});

				// 3. Remove all licenses
				const licenses = current.assignedLicenses as Array<{ skuId: string }>;
				if (licenses.length > 0) {
					await graphClient.request(tenantId, `/users/${user.id}/assignLicense`, {
						method: 'POST',
						body: JSON.stringify({
							addLicenses: [],
							removeLicenses: licenses.map((l) => l.skuId)
						})
					});
				}

				afterState.push({ userId: user.id, accountEnabled: false, licensesRemoved: licenses.length });
			} catch (err) {
				return { success: false, beforeState, afterState, error: `Failed for user ${user.id}: ${err}` };
			}
		}

		return { success: true, beforeState, afterState };
	},

	async dryRun(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<DryRunResult> {
		const users = resources as Array<{ id: string; name?: string }>;
		return {
			changes: users.map((u) => ({
				resource: `User: ${u.name ?? u.id}`,
				action: 'Decommission',
				currentState: { accountEnabled: true },
				newState: { accountEnabled: false, sessions: 'revoked', licenses: 'removed' }
			}))
		};
	}
};
