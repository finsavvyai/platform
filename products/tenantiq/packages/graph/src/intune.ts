/**
 * Microsoft Intune (Endpoint Manager) Graph wrappers.
 *
 * Endpoints used:
 *  - /deviceManagement/managedDevices       — enrolled devices
 *  - /deviceManagement/deviceCompliancePolicies
 *  - /deviceManagement/deviceConfigurations — config profiles
 *  - /deviceAppManagement/managedAppPolicies — App Protection (MAM)
 *  - /deviceAppManagement/mobileApps         — managed apps catalog
 *
 * Required app permissions (Azure AD app registration):
 *  - DeviceManagementManagedDevices.Read.All
 *  - DeviceManagementConfiguration.Read.All
 *  - DeviceManagementApps.Read.All
 */

import { GraphClient } from './client';

export type IntuneOs = 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
export type IntuneComplianceState = 'compliant' | 'noncompliant' | 'inGracePeriod' | 'configManager' | 'error' | 'unknown';

export interface IntuneManagedDevice {
	id: string;
	deviceName: string;
	userPrincipalName: string | null;
	operatingSystem: IntuneOs;
	osVersion: string;
	complianceState: IntuneComplianceState;
	lastSyncDateTime: string;
	enrolledDateTime: string;
	isEncrypted: boolean;
	jailBroken: 'Unknown' | 'True' | 'False';
	managementAgent: string;
	manufacturer: string | null;
	model: string | null;
	serialNumber: string | null;
}

export interface IntuneCompliancePolicy {
	id: string;
	displayName: string;
	platform: IntuneOs;
	createdDateTime: string;
	lastModifiedDateTime: string;
	roleScopeTagIds: string[];
	assignmentCount: number;
}

export interface IntuneAppProtectionPolicy {
	id: string;
	displayName: string;
	platform: 'iOS' | 'Android';
	deployedAppCount: number;
	pinRequired: boolean;
	encryptAppData: boolean;
	disableAppPinIfDevicePinIsSet: boolean;
	managedBrowserBlockedAppNamespace: string | null;
	createdDateTime: string;
	lastModifiedDateTime: string;
}

export class IntuneOperations {
	constructor(private client: GraphClient) {}

	async listManagedDevices(tenantId: string): Promise<IntuneManagedDevice[]> {
		const out: IntuneManagedDevice[] = [];
		for await (const batch of this.client.paginate<{ value: RawDevice[] }>(
			tenantId,
			'/deviceManagement/managedDevices?$top=100',
		)) {
			for (const page of batch as unknown as RawDevice[][]) {
				for (const d of page) out.push(mapDevice(d));
			}
		}
		return out;
	}

	async listCompliancePolicies(tenantId: string): Promise<IntuneCompliancePolicy[]> {
		const res = await this.client.request<{ value: RawCompliancePolicy[] }>(
			tenantId,
			'/deviceManagement/deviceCompliancePolicies?$expand=assignments',
		);
		return (res.value ?? []).map((p) => ({
			id: p.id,
			displayName: p.displayName ?? '(unnamed)',
			platform: detectPolicyPlatform(p['@odata.type']),
			createdDateTime: p.createdDateTime ?? '',
			lastModifiedDateTime: p.lastModifiedDateTime ?? '',
			roleScopeTagIds: p.roleScopeTagIds ?? [],
			assignmentCount: (p.assignments ?? []).length,
		}));
	}

	async listAppProtectionPolicies(tenantId: string): Promise<IntuneAppProtectionPolicy[]> {
		const [ios, android] = await Promise.all([
			this.client.request<{ value: RawAppPolicy[] }>(
				tenantId,
				'/deviceAppManagement/iosManagedAppProtections?$expand=apps',
			).catch(() => ({ value: [] })),
			this.client.request<{ value: RawAppPolicy[] }>(
				tenantId,
				'/deviceAppManagement/androidManagedAppProtections?$expand=apps',
			).catch(() => ({ value: [] })),
		]);
		const all: IntuneAppProtectionPolicy[] = [];
		for (const p of ios.value ?? []) all.push(mapAppPolicy(p, 'iOS'));
		for (const p of android.value ?? []) all.push(mapAppPolicy(p, 'Android'));
		return all;
	}
}

interface RawDevice {
	id: string;
	deviceName?: string;
	userPrincipalName?: string;
	operatingSystem?: string;
	osVersion?: string;
	complianceState?: string;
	lastSyncDateTime?: string;
	enrolledDateTime?: string;
	isEncrypted?: boolean;
	jailBroken?: string;
	managementAgent?: string;
	manufacturer?: string;
	model?: string;
	serialNumber?: string;
}

interface RawCompliancePolicy {
	id: string;
	displayName?: string;
	'@odata.type'?: string;
	createdDateTime?: string;
	lastModifiedDateTime?: string;
	roleScopeTagIds?: string[];
	assignments?: unknown[];
}

interface RawAppPolicy {
	id: string;
	displayName?: string;
	pinRequired?: boolean;
	encryptAppData?: boolean;
	disableAppPinIfDevicePinIsSet?: boolean;
	managedBrowserBlockedAppNamespace?: string;
	createdDateTime?: string;
	lastModifiedDateTime?: string;
	apps?: unknown[];
}

function mapDevice(d: RawDevice): IntuneManagedDevice {
	const os = (d.operatingSystem ?? 'Unknown') as IntuneOs;
	const compliance = (d.complianceState ?? 'unknown') as IntuneComplianceState;
	return {
		id: d.id,
		deviceName: d.deviceName ?? '(no name)',
		userPrincipalName: d.userPrincipalName ?? null,
		operatingSystem: ['iOS', 'Android', 'Windows', 'macOS', 'Linux'].includes(os) ? os : 'Unknown',
		osVersion: d.osVersion ?? '',
		complianceState: compliance,
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

function detectPolicyPlatform(odataType?: string): IntuneOs {
	if (!odataType) return 'Unknown';
	const t = odataType.toLowerCase();
	if (t.includes('ios')) return 'iOS';
	if (t.includes('android')) return 'Android';
	if (t.includes('windows')) return 'Windows';
	if (t.includes('macos')) return 'macOS';
	if (t.includes('linux')) return 'Linux';
	return 'Unknown';
}
