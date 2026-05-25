import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const removeGuest: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_007,
	name: 'Remove Guest User',
	description: 'Permanently removes the guest user from the directory. This action cannot be undone.',
	reversible: false,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const guests = resources as Array<{ id: string; name?: string; email?: string }>;
		const beforeState: unknown[] = [];
		const afterState: unknown[] = [];

		for (const guest of guests) {
			try {
				// Capture before state
				const current = await graphClient.request(tenantId, `/users/${guest.id}?$select=displayName,mail,userType`);
				beforeState.push(current);

				// Delete the guest user
				await graphClient.request(tenantId, `/users/${guest.id}`, { method: 'DELETE' });
				afterState.push({ userId: guest.id, deleted: true });
			} catch (err) {
				return { success: false, beforeState, afterState, error: `Failed for guest ${guest.id}: ${err}` };
			}
		}

		return { success: true, beforeState, afterState };
	},

	async dryRun(tenantId: string, resources: unknown[], _graphClient: GraphClient): Promise<DryRunResult> {
		const guests = resources as Array<{ id: string; name?: string; email?: string }>;
		return {
			changes: guests.map((g) => ({
				resource: `Guest: ${g.name ?? g.email ?? g.id}`,
				action: 'Delete guest user (irreversible)',
				currentState: { exists: true, userType: 'guest' },
				newState: { exists: false, deleted: true }
			}))
		};
	}
};
