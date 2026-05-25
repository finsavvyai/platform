/**
 * Intune (Endpoint Manager) posture scanner.
 *
 * Pulls managed devices, compliance policies, and app protection policies
 * via Microsoft Graph and emits findings for an MSP audit dashboard.
 *
 * Findings categories:
 *   - Device hygiene: stale check-in, unencrypted, jailbroken, OS-version drift
 *   - Policy coverage: unassigned compliance policies, no policy per platform
 *   - App Protection (MAM): missing PIN/encryption, no policies for platform
 */

import type {
	IntuneManagedDevice,
	IntuneCompliancePolicy,
	IntuneAppProtectionPolicy,
	IntuneOs,
	IntuneOperations,
} from '@tenantiq/graph';
import {
	evaluateDeviceFindings,
	evaluateCompliancePolicyFindings,
	evaluateAppProtectionFindings,
} from './findings';
import type { IntuneFinding, IntuneSummary, IntuneScanResult } from './types';

export type { IntuneFinding, IntuneSummary, IntuneScanResult, IntuneFindingSeverity } from './types';

const STALE_DAYS = 30;

export async function runIntuneScan(
	tenantId: string,
	intune: IntuneOperations,
): Promise<IntuneScanResult> {
	const [devices, compliancePolicies, appPolicies] = await Promise.all([
		intune.listManagedDevices(tenantId),
		intune.listCompliancePolicies(tenantId),
		intune.listAppProtectionPolicies(tenantId),
	]);

	return assembleScan(devices, compliancePolicies, appPolicies);
}

export function assembleScan(
	devices: IntuneManagedDevice[],
	compliancePolicies: IntuneCompliancePolicy[],
	appPolicies: IntuneAppProtectionPolicy[],
): IntuneScanResult {
	const findings: IntuneFinding[] = [
		...evaluateDeviceFindings(devices),
		...evaluateCompliancePolicyFindings(compliancePolicies, devices),
		...evaluateAppProtectionFindings(appPolicies, devices),
	];

	const summary = buildSummary(devices, compliancePolicies, appPolicies, findings);
	return {
		scannedAt: new Date().toISOString(),
		summary,
		findings,
		devices,
	};
}

function buildSummary(
	devices: IntuneManagedDevice[],
	compliancePolicies: IntuneCompliancePolicy[],
	appPolicies: IntuneAppProtectionPolicy[],
	findings: IntuneFinding[],
): IntuneSummary {
	const total = devices.length;
	const compliant = devices.filter((d) => d.complianceState === 'compliant').length;
	const nonCompliant = devices.filter((d) => d.complianceState === 'noncompliant').length;
	const grace = devices.filter((d) => d.complianceState === 'inGracePeriod').length;
	const encrypted = devices.filter((d) => d.isEncrypted).length;
	const jailbroken = devices.filter((d) => d.jailBroken === 'True').length;
	const now = Date.now();
	const stale = devices.filter((d) => {
		if (!d.lastSyncDateTime) return false;
		return now - Date.parse(d.lastSyncDateTime) > STALE_DAYS * 86400_000;
	}).length;

	const os: Record<IntuneOs, number> = {
		iOS: 0, Android: 0, Windows: 0, macOS: 0, Linux: 0, Unknown: 0,
	};
	for (const d of devices) os[d.operatingSystem]++;

	const platforms = new Set(devices.map((d) => d.operatingSystem));
	const platformsWithoutMam: ('iOS' | 'Android')[] = [];
	for (const p of ['iOS', 'Android'] as const) {
		if (platforms.has(p) && !appPolicies.some((ap) => ap.platform === p)) {
			platformsWithoutMam.push(p);
		}
	}

	const unassignedPolicies = compliancePolicies.filter((p) => p.assignmentCount === 0).length;
	const postureScore = computePostureScore({
		total,
		compliant,
		encrypted,
		stale,
		jailbroken,
		critical: findings.filter((f) => f.severity === 'critical').length,
		high: findings.filter((f) => f.severity === 'high').length,
	});

	return {
		totalDevices: total,
		compliantDevices: compliant,
		noncompliantDevices: nonCompliant,
		gracePeriodDevices: grace,
		encryptionRate: total === 0 ? 0 : encrypted / total,
		jailbrokenCount: jailbroken,
		staleEnrollmentCount: stale,
		osBreakdown: os,
		compliancePolicyCount: compliancePolicies.length,
		unassignedCompliancePolicyCount: unassignedPolicies,
		appProtectionPolicyCount: appPolicies.length,
		platformsWithoutMam,
		postureScore,
	};
}

function computePostureScore(input: {
	total: number;
	compliant: number;
	encrypted: number;
	stale: number;
	jailbroken: number;
	critical: number;
	high: number;
}): number {
	if (input.total === 0) return 0;
	const complianceRate = input.compliant / input.total;
	const encryptionRate = input.encrypted / input.total;
	const staleRate = input.stale / input.total;
	const base = Math.round(complianceRate * 50 + encryptionRate * 35 + (1 - staleRate) * 15);
	const penalty = input.critical * 8 + input.high * 3 + input.jailbroken * 5;
	return Math.max(0, Math.min(100, base - penalty));
}
