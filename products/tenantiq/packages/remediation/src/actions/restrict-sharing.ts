import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const restrictSharing: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_008,
	name: 'Restrict External Sharing',
	description: 'Restricts external sharing by updating guest access and invitation policies.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		// Fetch current authorization policy to capture beforeState
		const currentPolicy = await graphClient.request<{
			id: string;
			allowInvitesFrom: string;
			allowedToSignUpEmailBasedSubscriptions: boolean;
			guestUserRoleId: string;
		}>(tenantId, '/policies/authorizationPolicy');

		const beforeState = {
			allowInvitesFrom: currentPolicy.allowInvitesFrom,
			guestUserRoleId: currentPolicy.guestUserRoleId
		};

		// Restrict: only admins can invite, guests get restricted role
		// Guest role ID for "Restricted access": 2af84b1e-32c8-42b7-82bc-daa82404023b
		await graphClient.request(tenantId, '/policies/authorizationPolicy', {
			method: 'PATCH',
			body: JSON.stringify({
				allowInvitesFrom: 'adminsAndGuestInviters',
				guestUserRoleId: '2af84b1e-32c8-42b7-82bc-daa82404023b'
			})
		});

		return {
			success: true,
			beforeState,
			afterState: {
				allowInvitesFrom: 'adminsAndGuestInviters',
				guestUserRoleId: '2af84b1e-32c8-42b7-82bc-daa82404023b'
			}
		};
	},

	async dryRun(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<DryRunResult> {
		let currentPolicy: { allowInvitesFrom?: string; guestUserRoleId?: string } = {};
		try {
			currentPolicy = await graphClient.request(tenantId, '/policies/authorizationPolicy');
		} catch {
			// Proceed with unknown current state
		}

		return {
			changes: [{
				resource: 'Authorization Policy',
				action: 'Restrict external sharing — limit guest invitations to admins, set restricted guest role',
				currentState: {
					allowInvitesFrom: currentPolicy.allowInvitesFrom ?? 'unknown',
					guestUserRoleId: currentPolicy.guestUserRoleId ?? 'unknown'
				},
				newState: {
					allowInvitesFrom: 'adminsAndGuestInviters',
					guestUserRoleId: '2af84b1e-32c8-42b7-82bc-daa82404023b (restricted)'
				}
			}]
		};
	}
};
