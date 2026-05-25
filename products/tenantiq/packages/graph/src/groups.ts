import { GraphClient } from './client';

export class GroupOperations {
	constructor(private client: GraphClient) {}

	/**
	 * List all groups with owners.
	 */
	async listWithOwners(tenantId: string) {
		const groups: unknown[] = [];
		const path = '/groups?$select=id,displayName,groupTypes,membershipRule,createdDateTime&$expand=owners($select=id,displayName)&$top=999';

		for await (const batch of this.client.paginate<unknown>(tenantId, path)) {
			groups.push(...batch);
		}

		return groups;
	}

	/**
	 * Get group members.
	 */
	async getMembers(tenantId: string, groupId: string) {
		return this.client.request<{ value: unknown[] }>(tenantId, `/groups/${groupId}/members?$select=id,displayName,mail`);
	}

	/**
	 * Create a new group.
	 */
	async createGroup(tenantId: string, group: { displayName: string; mailEnabled: boolean; securityEnabled: boolean; mailNickname: string; groupTypes: string[] }) {
		return this.client.request(tenantId, '/groups', {
			method: 'POST',
			body: JSON.stringify(group)
		});
	}
}
