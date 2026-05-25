/**
 * Fetch raw Intune data via the local apps/api GraphClient.
 *
 * Returns shapes consumed by lib/intune/scanner.ts:assembleScan(). Kept
 * separate from the scanner so the scanner stays pure (testable without
 * mocking Graph) and so this file can change cloud/auth without touching
 * scoring logic.
 */

import { GraphClient } from '../graph-client';
import type {
	IntuneManagedDevice,
	IntuneCompliancePolicy,
	IntuneAppProtectionPolicy,
	IntuneOs,
} from '@tenantiq/graph';

const GRAPH_V1 = 'https://graph.microsoft.com/v1.0';

interface RawDevice {
	id: string; deviceName?: string; userPrincipalName?: string;
	operatingSystem?: string; osVersion?: string; complianceState?: string;
	lastSyncDateTime?: string; enrolledDateTime?: string;
	isEncrypted?: boolean; jailBroken?: string; managementAgent?: string;
	manufacturer?: string; model?: string; serialNumber?: string;
}
interface RawPolicy {
	id: string; displayName?: string; '@odata.type'?: string;
	createdDateTime?: string; lastModifiedDateTime?: string;
	roleScopeTagIds?: string[]; assignments?: unknown[];
}
interface RawAppPolicy {
	id: string; displayName?: string; pinRequired?: boolean;
	encryptAppData?: boolean; disableAppPinIfDevicePinIsSet?: boolean;
	managedBrowserBlockedAppNamespace?: string;
	createdDateTime?: string; lastModifiedDateTime?: string; apps?: unknown[];
}

export async function fetchIntuneInventory(graph: GraphClient): Promise<{
	devices: IntuneManagedDevice[];
	compliancePolicies: IntuneCompliancePolicy[];
	appPolicies: IntuneAppProtectionPolicy[];
}> {
	const [devices, compliancePolicies, appPolicies] = await Promise.all([
		fetchDevices(graph),
		fetchCompliancePolicies(graph),
		fetchAppProtectionPolicies(graph),
	]);
	return { devices, compliancePolicies, appPolicies };
}

async function fetchDevices(graph: GraphClient): Promise<IntuneManagedDevice[]> {
	const raws = await graph.fetchAll<RawDevice>(`${GRAPH_V1}/deviceManagement/managedDevices?$top=200`)
		.catch(() => [] as RawDevice[]);
	return raws.map(mapDevice);
}

async function fetchCompliancePolicies(graph: GraphClient): Promise<IntuneCompliancePolicy[]> {
	const res = await graph.request<{ value: RawPolicy[] }>(
		`${GRAPH_V1}/deviceManagement/deviceCompliancePolicies?$expand=assignments`,
	).catch(() => ({ value: [] as RawPolicy[] }));
	return (res.value ?? []).map((p) => ({
		id: p.id,
		displayName: p.displayName ?? '(unnamed)',
		platform: detectPlatform(p['@odata.type']),
		createdDateTime: p.createdDateTime ?? '',
		lastModifiedDateTime: p.lastModifiedDateTime ?? '',
		roleScopeTagIds: p.roleScopeTagIds ?? [],
		assignmentCount: (p.assignments ?? []).length,
	}));
}

async function fetchAppProtectionPolicies(graph: GraphClient): Promise<IntuneAppProtectionPolicy[]> {
	const [ios, android] = await Promise.all([
		graph.request<{ value: RawAppPolicy[] }>(
			`${GRAPH_V1}/deviceAppManagement/iosManagedAppProtections?$expand=apps`,
		).catch(() => ({ value: [] as RawAppPolicy[] })),
		graph.request<{ value: RawAppPolicy[] }>(
			`${GRAPH_V1}/deviceAppManagement/androidManagedAppProtections?$expand=apps`,
		).catch(() => ({ value: [] as RawAppPolicy[] })),
	]);
	const out: IntuneAppProtectionPolicy[] = [];
	for (const p of ios.value ?? []) out.push(mapAppPolicy(p, 'iOS'));
	for (const p of android.value ?? []) out.push(mapAppPolicy(p, 'Android'));
	return out;
}

function mapDevice(d: RawDevice): IntuneManagedDevice {
	const osRaw = (d.operatingSystem ?? 'Unknown') as IntuneOs;
	const os: IntuneOs = ['iOS', 'Android', 'Windows', 'macOS', 'Linux'].includes(osRaw) ? osRaw : 'Unknown';
	const cs = (d.complianceState ?? 'unknown') as IntuneManagedDevice['complianceState'];
	return {
		id: d.id,
		deviceName: d.deviceName ?? '(no name)',
		userPrincipalName: d.userPrincipalName ?? null,
		operatingSystem: os,
		osVersion: d.osVersion ?? '',
		complianceState: cs,
		lastSyncDateTime: d.lastSyncDateTime ?? '',
		enrolledDateTime: d.enrolledDateTime ?? '',
		isEncrypted: d.isEncrypted === true,
		jailBroken: (d.jailBroken === 'True' || d.jailBroken === 'False') ? d.jailBroken : 'Unknown',
		managementAgent: d.managementAgent ?? '',
		manufacturer: d.manufacturer ?? null,
		model: d.model ?? null,
		serialNumber: d.serialNumber ?? null,
	};
}

function mapAppPolicy(p: RawAppPolicy, platform: 'iOS' | 'Android'): IntuneAppProtectionPolicy {
	return {
		id: p.id,
		displayName: p.displayName ?? '(unnamed)',
		platform,
		deployedAppCount: (p.apps ?? []).length,
		pinRequired: p.pinRequired === true,
		encryptAppData: p.encryptAppData === true,
		disableAppPinIfDevicePinIsSet: p.disableAppPinIfDevicePinIsSet === true,
		managedBrowserBlockedAppNamespace: p.managedBrowserBlockedAppNamespace ?? null,
		createdDateTime: p.createdDateTime ?? '',
		lastModifiedDateTime: p.lastModifiedDateTime ?? '',
	};
}

function detectPlatform(odataType?: string): IntuneOs {
	if (!odataType) return 'Unknown';
	const t = odataType.toLowerCase();
	if (t.includes('ios')) return 'iOS';
	if (t.includes('android')) return 'Android';
	if (t.includes('windows')) return 'Windows';
	if (t.includes('macos')) return 'macOS';
	if (t.includes('linux')) return 'Linux';
	return 'Unknown';
}
