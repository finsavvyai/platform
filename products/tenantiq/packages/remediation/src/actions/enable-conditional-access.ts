import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const enableConditionalAccess: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_009,
	name: 'Enable Conditional Access Policy',
	description: 'Enables disabled conditional access policies to restore security controls.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const policies = resources as Array<{ id: string; displayName?: string }>;
		const beforeState: Array<{ id: string; state: string }> = [];
		const afterState: Array<{ id: string; state: string }> = [];

		for (const policy of policies) {
			try {
				// Capture current state before enabling
				const current = await graphClient.request<{ id: string; state: string }>(
					tenantId,
					`/identity/conditionalAccessPolicies/${policy.id}?$select=id,state`
				);
				beforeState.push({ id: policy.id, state: current.state });

				// Enable the policy
				await graphClient.request(tenantId, `/identity/conditionalAccessPolicies/${policy.id}`, {
					method: 'PATCH',
					body: JSON.stringify({ state: 'enabled' })
				});
				afterState.push({ id: policy.id, state: 'enabled' });
			} catch (err) {
				return {
					success: false,
					beforeState,
					afterState,
					error: `Failed to enable policy ${policy.id}: ${err}`
				};
			}
		}

		return { success: true, beforeState, afterState };
	},

	async dryRun(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<DryRunResult> {
		const policies = resources as Array<{ id: string; displayName?: string }>;
		const changes: DryRunResult['changes'] = [];

		for (const policy of policies) {
			let currentState = 'unknown';
			try {
				const current = await graphClient.request<{ state: string }>(
					tenantId,
					`/identity/conditionalAccessPolicies/${policy.id}?$select=state`
				);
				currentState = current.state;
			} catch {
				// Proceed with unknown state
			}

			changes.push({
				resource: `CA Policy: ${policy.displayName ?? policy.id}`,
				action: 'Enable conditional access policy',
				currentState: { state: currentState },
				newState: { state: 'enabled' }
			});
		}

		return { changes };
	}
};
