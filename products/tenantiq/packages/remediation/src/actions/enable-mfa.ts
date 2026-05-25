import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const enableMfa: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_002,
	name: 'Enable MFA Policy',
	description: 'Enables a conditional access policy to enforce MFA for the specified scope.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const policies = resources as Array<{ id?: string; type?: string }>;

		// If specific policy IDs provided, enable them
		if (policies.length > 0 && policies[0].id) {
			const beforeState: unknown[] = [];
			for (const policy of policies) {
				const current = await graphClient.request(tenantId, `/identity/conditionalAccessPolicies/${policy.id}`);
				beforeState.push(current);

				await graphClient.request(tenantId, `/identity/conditionalAccessPolicies/${policy.id}`, {
					method: 'PATCH',
					body: JSON.stringify({ state: 'enabled' })
				});
			}
			return { success: true, beforeState, afterState: { policiesEnabled: policies.length } };
		}

		// Otherwise, create a new MFA policy for all admin roles
		const newPolicy = await graphClient.request(tenantId, '/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: 'TenantIQ: Require MFA for Admins',
				state: 'enabled',
				conditions: {
					users: {
						includeRoles: [
							'62e90394-69f5-4237-9190-012177145e10', // Global Admin
							'fe930be7-5e62-47db-91af-98c3a49a38b1', // User Admin
							'29232cdf-9323-42fd-ade2-1d097af3e4de'  // Exchange Admin
						]
					},
					applications: { includeApplications: ['All'] }
				},
				grantControls: {
					operator: 'OR',
					builtInControls: ['mfa']
				}
			})
		});

		return { success: true, beforeState: null, afterState: { policyCreated: newPolicy } };
	},

	async dryRun(tenantId: string, resources: unknown[], _graphClient: GraphClient): Promise<DryRunResult> {
		return {
			changes: [{
				resource: 'Conditional Access Policy',
				action: 'Create/Enable MFA policy',
				currentState: { mfaEnforced: false },
				newState: { mfaEnforced: true, scope: 'admin roles' }
			}]
		};
	}
};
