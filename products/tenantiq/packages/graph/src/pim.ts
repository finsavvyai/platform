/**
 * Microsoft Entra ID PIM (Privileged Identity Management) Graph wrappers.
 *
 * PIM data model:
 *   - roleDefinition         — catalog of directory roles (Global Admin, etc.)
 *   - roleAssignment         — *standing* (non-PIM) assignment, always active
 *   - roleEligibilitySchedule — PIM eligibility (user can activate JIT)
 *   - roleAssignmentSchedule — PIM active (user activated, time-bounded)
 *
 * Required permissions: RoleManagement.Read.Directory (or .All)
 */
import { GraphClient } from './client';

export type PimAssignmentKind = 'standing' | 'eligible' | 'active';

export interface PimRoleDefinition {
	id: string;
	displayName: string;
	templateId: string;
	isBuiltIn: boolean;
	isPrivileged: boolean;
}

export interface PimRoleAssignment {
	id: string;
	kind: PimAssignmentKind;
	roleDefinitionId: string;
	roleDisplayName: string;
	principalId: string;
	principalDisplayName: string | null;
	principalUpn: string | null;
	principalType: 'user' | 'group' | 'servicePrincipal' | 'unknown';
	startDateTime: string | null;
	endDateTime: string | null; // null = no expiration (perpetual)
	createdDateTime: string | null;
}

interface RawRoleDef {
	id?: string;
	displayName?: string;
	templateId?: string;
	isBuiltIn?: boolean;
}

interface RawAssignment {
	id?: string;
	roleDefinitionId?: string;
	principalId?: string;
	startDateTime?: string;
	endDateTime?: string;
	createdDateTime?: string;
	principal?: {
		'@odata.type'?: string;
		id?: string;
		displayName?: string;
		userPrincipalName?: string;
	};
	roleDefinition?: { displayName?: string };
}

const PRIVILEGED_TEMPLATES = new Set([
	'62e90394-69f5-4237-9190-012177145e10', // Global Administrator
	'fe930be7-5e62-47db-91af-98c3a49a38b1', // User Administrator
	'9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3', // Application Administrator
	'158c047a-c907-4556-b7ef-446551a6b5f7', // Cloud Application Administrator
	'b0f54661-2d74-4c50-afa3-1ec803f12efe', // Billing Administrator
	'729827e3-9c14-49f7-bb1b-9608f156bbb8', // Helpdesk Administrator
	'f28a1f50-f6e7-4571-818b-6a12f2af6b6c', // SharePoint Administrator
	'29232cdf-9323-42fd-ade2-1d097af3e4de', // Exchange Administrator
	'69091246-20e8-4a56-aa4d-066075b2a7a8', // Teams Administrator
	'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
	'194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
	'7be44c8a-adaf-4e2a-84d6-ab2649e08a13', // Privileged Authentication Administrator
]);

export class PimOperations {
	constructor(private client: GraphClient) {}

	async listRoleDefinitions(tenantId: string): Promise<PimRoleDefinition[]> {
		const res = await this.client.request<{ value: RawRoleDef[] }>(
			tenantId,
			'/roleManagement/directory/roleDefinitions',
		);
		return (res.value ?? []).map((r) => ({
			id: r.id ?? '',
			displayName: r.displayName ?? '(unknown)',
			templateId: r.templateId ?? '',
			isBuiltIn: r.isBuiltIn === true,
			isPrivileged: PRIVILEGED_TEMPLATES.has(r.templateId ?? ''),
		}));
	}

	async listStandingAssignments(tenantId: string): Promise<PimRoleAssignment[]> {
		const res = await this.client.request<{ value: RawAssignment[] }>(
			tenantId,
			'/roleManagement/directory/roleAssignments?$expand=principal,roleDefinition',
		);
		return (res.value ?? []).map((r) => mapAssignment(r, 'standing'));
	}

	async listEligibleAssignments(tenantId: string): Promise<PimRoleAssignment[]> {
		const res = await this.client.request<{ value: RawAssignment[] }>(
			tenantId,
			'/roleManagement/directory/roleEligibilityScheduleInstances?$expand=principal,roleDefinition',
		).catch(() => ({ value: [] as RawAssignment[] }));
		return (res.value ?? []).map((r) => mapAssignment(r, 'eligible'));
	}

	async listActivePimAssignments(tenantId: string): Promise<PimRoleAssignment[]> {
		const res = await this.client.request<{ value: RawAssignment[] }>(
			tenantId,
			'/roleManagement/directory/roleAssignmentScheduleInstances?$expand=principal,roleDefinition',
		).catch(() => ({ value: [] as RawAssignment[] }));
		return (res.value ?? []).map((r) => mapAssignment(r, 'active'));
	}
}

function mapAssignment(r: RawAssignment, kind: PimAssignmentKind): PimRoleAssignment {
	const odata = r.principal?.['@odata.type']?.toLowerCase() ?? '';
	let principalType: PimRoleAssignment['principalType'] = 'unknown';
	if (odata.includes('user')) principalType = 'user';
	else if (odata.includes('group')) principalType = 'group';
	else if (odata.includes('serviceprincipal')) principalType = 'servicePrincipal';

	return {
		id: r.id ?? '',
		kind,
		roleDefinitionId: r.roleDefinitionId ?? '',
		roleDisplayName: r.roleDefinition?.displayName ?? '(unknown role)',
		principalId: r.principalId ?? r.principal?.id ?? '',
		principalDisplayName: r.principal?.displayName ?? null,
		principalUpn: r.principal?.userPrincipalName ?? null,
		principalType,
		startDateTime: r.startDateTime ?? null,
		endDateTime: r.endDateTime ?? null,
		createdDateTime: r.createdDateTime ?? null,
	};
}

export const PIM_PRIVILEGED_TEMPLATE_IDS = PRIVILEGED_TEMPLATES;
