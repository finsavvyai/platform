import { GraphClient } from './client';

export class PolicyOperations {
	constructor(private client: GraphClient) {}

	/**
	 * List all conditional access policies.
	 */
	async listConditionalAccessPolicies(tenantId: string) {
		return this.client.request<{ value: unknown[] }>(tenantId, '/identity/conditionalAccessPolicies');
	}

	/**
	 * Enable a conditional access policy.
	 */
	async enablePolicy(tenantId: string, policyId: string) {
		return this.client.request(tenantId, `/identity/conditionalAccessPolicies/${policyId}`, {
			method: 'PATCH',
			body: JSON.stringify({ state: 'enabled' })
		});
	}

	/**
	 * Disable a conditional access policy.
	 */
	async disablePolicy(tenantId: string, policyId: string) {
		return this.client.request(tenantId, `/identity/conditionalAccessPolicies/${policyId}`, {
			method: 'PATCH',
			body: JSON.stringify({ state: 'disabled' })
		});
	}

	/**
	 * Create a conditional access policy to block an IP range.
	 */
	async createIpBlockPolicy(tenantId: string, name: string, ipRanges: string[]) {
		// First, create a named location
		const location = await this.client.request<{ id: string }>(tenantId, '/identity/conditionalAccess/namedLocations', {
			method: 'POST',
			body: JSON.stringify({
				'@odata.type': '#microsoft.graph.ipNamedLocation',
				displayName: `TenantIQ Block: ${name}`,
				isTrusted: false,
				ipRanges: ipRanges.map((ip) => ({
					'@odata.type': '#microsoft.graph.iPv4CidrRange',
					cidrAddress: ip
				}))
			})
		});

		// Then create a policy that blocks this location
		return this.client.request(tenantId, '/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: `TenantIQ: Block ${name}`,
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					locations: {
						includeLocations: [location.id]
					}
				},
				grantControls: {
					operator: 'OR',
					builtInControls: ['block']
				}
			})
		});
	}
}
