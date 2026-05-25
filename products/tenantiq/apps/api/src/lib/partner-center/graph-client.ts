/**
 * Partner Center Graph helpers.
 *
 * Wraps the standard Graph client with the partner's tenant ID so calls hit
 * the Partner Center surfaces under /tenantRelationships/*. The partner's
 * AAD app must have DelegatedAdminRelationship.ReadWrite.All consented.
 *
 * Docs: learn.microsoft.com/en-us/graph/api/resources/delegatedadminrelationship
 */

import { createGraphClient, type GraphClient } from '../graph-client';
import type { ClientEnv } from '../graph-types';

export interface DelegatedRelationshipInput {
	displayName: string;
	customerTenantId: string;
	durationInDays: number;
	unifiedRoles: { roleDefinitionId: string }[];
}

export interface DelegatedRelationship {
	id: string;
	displayName: string;
	status: string;
	customer?: { tenantId: string; displayName?: string };
	accessDetails?: { unifiedRoles: { roleDefinitionId: string }[] };
	duration: string;
	createdDateTime?: string;
	activatedDateTime?: string;
	endDateTime?: string;
}

export interface AccessAssignmentInput {
	accessContainer: { accessContainerId: string; accessContainerType: 'securityGroup' };
	accessDetails: { unifiedRoles: { roleDefinitionId: string }[] };
}

export interface AccessAssignment {
	id: string;
	status: string;
	accessContainer: { accessContainerId: string; accessContainerType: string };
	accessDetails: { unifiedRoles: { roleDefinitionId: string }[] };
	createdDateTime?: string;
}

const PC_BASE = '/tenantRelationships/delegatedAdminRelationships';

export class PartnerCenterClient {
	private graph: GraphClient;
	private base: string;

	constructor(env: ClientEnv, partnerTenantId: string) {
		this.graph = createGraphClient(env, partnerTenantId);
		this.base = `${(this.graph as unknown as { base: string }).base}${PC_BASE}`;
	}

	/** Create a new delegated admin relationship invitation. Status starts as `created`. */
	async createRelationship(input: DelegatedRelationshipInput): Promise<DelegatedRelationship> {
		const body = {
			displayName: input.displayName,
			duration: `P${input.durationInDays}D`,
			customer: { tenantId: input.customerTenantId },
			accessDetails: { unifiedRoles: input.unifiedRoles },
		};
		return this.graph.request<DelegatedRelationship>(this.base, {
			method: 'POST', body: JSON.stringify(body),
		});
	}

	/** Send the invitation to the customer (transitions `created` → `approvalPending`). */
	async sendInvitation(relationshipId: string): Promise<{ inviteUrl: string }> {
		const url = `${this.base}/${encodeURIComponent(relationshipId)}/requests`;
		return this.graph.request<{ inviteUrl: string }>(url, {
			method: 'POST', body: JSON.stringify({ action: 'lockForApproval' }),
		});
	}

	async listRelationships(): Promise<DelegatedRelationship[]> {
		return this.graph.fetchAll<DelegatedRelationship>(this.base);
	}

	async getRelationship(relationshipId: string): Promise<DelegatedRelationship> {
		return this.graph.request<DelegatedRelationship>(`${this.base}/${encodeURIComponent(relationshipId)}`);
	}

	/** Create an access assignment — binds a partner-tenant security group to the relationship's roles. */
	async createAccessAssignment(
		relationshipId: string, securityGroupId: string, roleDefinitionIds: string[],
	): Promise<AccessAssignment> {
		const body: AccessAssignmentInput = {
			accessContainer: { accessContainerId: securityGroupId, accessContainerType: 'securityGroup' },
			accessDetails: { unifiedRoles: roleDefinitionIds.map((id) => ({ roleDefinitionId: id })) },
		};
		const url = `${this.base}/${encodeURIComponent(relationshipId)}/accessAssignments`;
		return this.graph.request<AccessAssignment>(url, {
			method: 'POST', body: JSON.stringify(body),
		});
	}

	async listAccessAssignments(relationshipId: string): Promise<AccessAssignment[]> {
		const url = `${this.base}/${encodeURIComponent(relationshipId)}/accessAssignments`;
		return this.graph.fetchAll<AccessAssignment>(url);
	}

	/** Terminate a relationship (revokes all access assignments). */
	async terminateRelationship(relationshipId: string): Promise<void> {
		const url = `${this.base}/${encodeURIComponent(relationshipId)}/requests`;
		await this.graph.request(url, {
			method: 'POST', body: JSON.stringify({ action: 'terminationRequested' }),
		});
	}
}

export function createPartnerCenterClient(env: ClientEnv, partnerTenantId: string): PartnerCenterClient {
	return new PartnerCenterClient(env, partnerTenantId);
}
