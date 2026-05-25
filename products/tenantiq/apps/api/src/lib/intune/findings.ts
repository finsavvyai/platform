/**
 * Intune device-hygiene finding evaluators (encryption, jailbreak, OS-version,
 * stale enrollment, non-compliance). Pure: no I/O, no state. Compliance-policy
 * and app-protection evaluators live in findings-policies.ts.
 */
import type { IntuneManagedDevice } from '@tenantiq/graph';
import type { IntuneFinding } from './types';

export {
	evaluateCompliancePolicyFindings,
	evaluateAppProtectionFindings,
} from './findings-policies';

const STALE_DAYS = 30;
const MIN_IOS_MAJOR = 16;
const MIN_ANDROID_MAJOR = 12;
const MIN_WIN_BUILD = 19045;
const MIN_MACOS_MAJOR = 13;

export function evaluateDeviceFindings(devices: IntuneManagedDevice[]): IntuneFinding[] {
	const out: IntuneFinding[] = [];
	const now = Date.now();

	const noncompliant = devices.filter((d) => d.complianceState === 'noncompliant');
	if (noncompliant.length > 0) {
		out.push({
			id: 'INTUNE-DEV-001',
			severity: noncompliant.length > devices.length * 0.1 ? 'high' : 'medium',
			category: 'device',
			title: `${noncompliant.length} non-compliant device${noncompliant.length === 1 ? '' : 's'}`,
			detail: `Devices reporting non-compliant against assigned policies. ${pct(noncompliant.length, devices.length)} of fleet.`,
			remediation: 'Open Intune → Devices → Compliance and review per-device reasons. Common causes: encryption disabled, OS below minimum, password complexity.',
			affectedCount: noncompliant.length,
			deviceIds: noncompliant.slice(0, 50).map((d) => d.id),
		});
	}

	const unencrypted = devices.filter((d) => !d.isEncrypted && d.operatingSystem !== 'Linux');
	if (unencrypted.length > 0) {
		out.push({
			id: 'INTUNE-DEV-002',
			severity: 'critical',
			category: 'device',
			title: `${unencrypted.length} unencrypted device${unencrypted.length === 1 ? '' : 's'}`,
			detail: 'Disk encryption not enabled — laptop loss = full data exposure. M365 Cert C3 + ISO 27001 A.8.24 violation.',
			remediation: 'Windows: enforce BitLocker via Intune compliance policy. macOS: FileVault via Configuration profile. iOS/Android: hardware encryption is default but device may report unknown if enrollment incomplete.',
			affectedCount: unencrypted.length,
			deviceIds: unencrypted.slice(0, 50).map((d) => d.id),
		});
	}

	const jailbroken = devices.filter((d) => d.jailBroken === 'True');
	if (jailbroken.length > 0) {
		out.push({
			id: 'INTUNE-DEV-003',
			severity: 'critical',
			category: 'device',
			title: `${jailbroken.length} jailbroken/rooted device${jailbroken.length === 1 ? '' : 's'}`,
			detail: 'Jailbreak/root detected by Intune attestation. Sandbox guarantees broken — corporate data on these devices is unprotected.',
			remediation: 'Enable conditional access policy: "Block compromised devices". Wipe affected devices and re-enroll on factory firmware.',
			affectedCount: jailbroken.length,
			deviceIds: jailbroken.map((d) => d.id),
		});
	}

	const stale = devices.filter((d) => {
		if (!d.lastSyncDateTime) return false;
		const ts = Date.parse(d.lastSyncDateTime);
		if (isNaN(ts)) return false;
		return now - ts > STALE_DAYS * 86400_000;
	});
	if (stale.length > 0) {
		out.push({
			id: 'INTUNE-DEV-004',
			severity: stale.length > devices.length * 0.05 ? 'high' : 'medium',
			category: 'device',
			title: `${stale.length} stale enrollment${stale.length === 1 ? '' : 's'} (>${STALE_DAYS}d)`,
			detail: `Devices haven't checked in for over ${STALE_DAYS} days — likely lost, decommissioned, or wiped without retiring in Intune.`,
			remediation: 'Intune → Devices → All devices → filter "Last check-in > 30 days" → bulk action: Retire (preserves user data) or Wipe (factory).',
			affectedCount: stale.length,
			deviceIds: stale.slice(0, 50).map((d) => d.id),
		});
	}

	const outdated = devices.filter(isOutdated);
	if (outdated.length > 0) {
		out.push({
			id: 'INTUNE-DEV-005',
			severity: 'high',
			category: 'device',
			title: `${outdated.length} device${outdated.length === 1 ? '' : 's'} on outdated OS`,
			detail: `Below minimum OS baseline (iOS ≥${MIN_IOS_MAJOR}, Android ≥${MIN_ANDROID_MAJOR}, Windows ≥10 22H2, macOS ≥${MIN_MACOS_MAJOR}). Unpatched OS = unmitigated CVEs.`,
			remediation: 'Add a compliance policy with "Minimum OS version" set per platform. Set non-compliance grace period to 14 days then auto-block via CA policy.',
			affectedCount: outdated.length,
			deviceIds: outdated.slice(0, 50).map((d) => d.id),
		});
	}

	return out;
}

function isOutdated(d: IntuneManagedDevice): boolean {
	if (!d.osVersion) return false;
	const v = d.osVersion.split('.').map((n) => parseInt(n, 10) || 0);
	switch (d.operatingSystem) {
		case 'iOS': return v[0] < MIN_IOS_MAJOR;
		case 'Android': return v[0] < MIN_ANDROID_MAJOR;
		case 'macOS': return v[0] < MIN_MACOS_MAJOR;
		case 'Windows':
			if (v[0] < 10) return true;
			if (v[0] === 10 && (v[2] || 0) < MIN_WIN_BUILD) return true;
			return false;
		default: return false;
	}
}

function pct(n: number, total: number): string {
	if (total === 0) return '0%';
	return `${Math.round((n / total) * 100)}%`;
}
