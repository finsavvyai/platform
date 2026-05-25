import type { RemediationAction, RemediationResult, DryRunResult } from '../executor';
import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export const blockIp: RemediationAction = {
	id: REMEDIATION_ACTION_IDS.REM_003,
	name: 'Block IP Range',
	description: 'Creates a conditional access policy to block sign-ins from the specified IP range.',
	reversible: true,

	async execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const ips = resources as Array<{ ip: string; failedAttempts?: number }>;
		const ipRanges = ips.map((r) => r.ip).filter(Boolean);

		if (ipRanges.length === 0) {
			return { success: false, beforeState: null, afterState: null, error: 'No IP addresses provided' };
		}

		// Create named location
		const location = await graphClient.request<{ id: string }>(
			tenantId, '/identity/conditionalAccess/namedLocations', {
				method: 'POST',
				body: JSON.stringify({
					'@odata.type': '#microsoft.graph.ipNamedLocation',
					displayName: `TenantIQ Block: ${new Date().toISOString().split('T')[0]}`,
					isTrusted: false,
					ipRanges: ipRanges.map((ip) => ({
						'@odata.type': ip.includes(':') ? '#microsoft.graph.iPv6CidrRange' : '#microsoft.graph.iPv4CidrRange',
						cidrAddress: ip.includes('/') ? ip : `${ip}/32`
					}))
				})
			}
		);

		// Create blocking policy
		const policy = await graphClient.request(tenantId, '/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: `TenantIQ: Block suspicious IPs - ${new Date().toISOString().split('T')[0]}`,
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					locations: { includeLocations: [location.id] }
				},
				grantControls: { operator: 'OR', builtInControls: ['block'] }
			})
		});

		return { success: true, beforeState: null, afterState: { locationId: location.id, policy, blockedIps: ipRanges } };
	},

	async dryRun(tenantId: string, resources: unknown[], _graphClient: GraphClient): Promise<DryRunResult> {
		const ips = resources as Array<{ ip: string }>;
		return {
			changes: [{
				resource: 'Conditional Access Policy',
				action: 'Block IP ranges',
				currentState: { blocked: false },
				newState: { blocked: true, ipRanges: ips.map((r) => r.ip) }
			}]
		};
	}
};
