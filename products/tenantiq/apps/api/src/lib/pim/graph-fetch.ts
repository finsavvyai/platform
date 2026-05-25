/**
 * Fetch PIM data via the local apps/api GraphClient. Returns shapes
 * consumed by lib/pim/scanner.ts:assemblePimScan().
 *
 * Required Graph permissions: RoleManagement.Read.Directory.
 * MFA registration data needs Reports.Read.All — gracefully handled.
 */
import { GraphClient } from '../graph-client';
import type {
	PimRoleAssignment,
	PimRoleDefinition,
	PimAssignmentKind,
} from '@tenantiq/graph';
import { PIM_PRIVILEGED_TEMPLATE_IDS } from '@tenantiq/graph';

const GRAPH_V1 = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';

interface RawDef { id?: string; displayName?: string; templateId?: string; isBuiltIn?: boolean }
interface RawAssignment {
	id?: string; roleDefinitionId?: string; principalId?: string;
	startDateTime?: string; endDateTime?: string; createdDateTime?: string;
	principal?: { '@odata.type'?: string; id?: string; displayName?: string; userPrincipalName?: string };
	roleDefinition?: { displayName?: string };
}
interface RawCredentialReg { id?: string; isMfaRegistered?: boolean }

export async function fetchPimInventory(graph: GraphClient): Promise<{
	roleDefs: PimRoleDefinition[];
	standing: PimRoleAssignment[];
	eligible: PimRoleAssignment[];
	active: PimRoleAssignment[];
	mfaRegistered: Map<string, boolean>;
}> {
	const [defsRes, standingRes, eligibleRes, activeRes, regRes] = await Promise.all([
		graph.request<{ value: RawDef[] }>(`${GRAPH_V1}/roleManagement/directory/roleDefinitions`)
			.catch(() => ({ value: [] as RawDef[] })),
		graph.request<{ value: RawAssignment[] }>(
			`${GRAPH_V1}/roleManagement/directory/roleAssignments?$expand=principal,roleDefinition`,
		).catch(() => ({ value: [] as RawAssignment[] })),
		graph.request<{ value: RawAssignment[] }>(
			`${GRAPH_V1}/roleManagement/directory/roleEligibilityScheduleInstances?$expand=principal,roleDefinition`,
		).catch(() => ({ value: [] as RawAssignment[] })),
		graph.request<{ value: RawAssignment[] }>(
			`${GRAPH_V1}/roleManagement/directory/roleAssignmentScheduleInstances?$expand=principal,roleDefinition`,
		).catch(() => ({ value: [] as RawAssignment[] })),
		graph.fetchAll<RawCredentialReg>(`${GRAPH_BETA}/reports/credentialUserRegistrationDetails?$top=200`)
			.catch(() => [] as RawCredentialReg[]),
	]);

	const roleDefs: PimRoleDefinition[] = (defsRes.value ?? []).map((r) => ({
		id: r.id ?? '',
		displayName: r.displayName ?? '(unknown)',
		templateId: r.templateId ?? '',
		isBuiltIn: r.isBuiltIn === true,
		isPrivileged: PIM_PRIVILEGED_TEMPLATE_IDS.has(r.templateId ?? ''),
	}));

	const mfaRegistered = new Map<string, boolean>();
	for (const r of regRes ?? []) if (r.id) mfaRegistered.set(r.id, r.isMfaRegistered === true);

	return {
		roleDefs,
		standing: (standingRes.value ?? []).map((r) => mapAssignment(r, 'standing')),
		eligible: (eligibleRes.value ?? []).map((r) => mapAssignment(r, 'eligible')),
		active: (activeRes.value ?? []).map((r) => mapAssignment(r, 'active')),
		mfaRegistered,
	};
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
