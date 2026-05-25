import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const forcePasswordReset: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_006,
	name: 'Force Password Reset',
	description: 'Forces affected users to change their password at next sign-in.',
	reversible: false,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const users = resources as Array<{ id: string; name?: string; email?: string }>;
		const results: unknown[] = [];

		for (const user of users) {
			try {
				await graphClient.request(tenantId, `/users/${user.id}`, {
					method: 'PATCH',
					body: JSON.stringify({
						passwordProfile: { forceChangePasswordNextSignIn: true }
					})
				});
				results.push({ userId: user.id, passwordResetForced: true });
			} catch (err) {
				return { success: false, beforeState: null, afterState: results, error: `Failed for user ${user.id}: ${err}` };
			}
		}

		return { success: true, beforeState: { usersAffected: users.length }, afterState: results };
	},

	async dryRun(tenantId: string, resources: unknown[], _graphClient: GraphClient): Promise<DryRunResult> {
		const users = resources as Array<{ id: string; name?: string }>;
		return {
			changes: users.map((u) => ({
				resource: `User: ${u.name ?? u.id}`,
				action: 'Force password change at next sign-in (irreversible)',
				currentState: { passwordChangeRequired: false },
				newState: { passwordChangeRequired: true }
			}))
		};
	}
};
