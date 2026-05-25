import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const revokeSessions: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_005,
	name: 'Revoke Sessions',
	description: 'Revokes all active sign-in sessions for the user, forcing them to re-authenticate.',
	reversible: false,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const users = resources as Array<{ id: string; name?: string; email?: string }>;
		const results: unknown[] = [];

		for (const user of users) {
			try {
				await graphClient.request(tenantId, `/users/${user.id}/revokeSignInSessions`, {
					method: 'POST'
				});
				results.push({ userId: user.id, sessionsRevoked: true });
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
				action: 'Revoke all sessions (irreversible)',
				currentState: { sessions: 'active' },
				newState: { sessions: 'revoked', mustReAuthenticate: true }
			}))
		};
	}
};
