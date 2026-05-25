/**
 * Intune compliance-policy + app-protection (MAM) finding evaluators.
 * Split from findings.ts to keep each file under 200 lines.
 */
import type {
	IntuneCompliancePolicy,
	IntuneAppProtectionPolicy,
	IntuneManagedDevice,
	IntuneOs,
} from '@tenantiq/graph';
import type { IntuneFinding } from './types';

export function evaluateCompliancePolicyFindings(
	policies: IntuneCompliancePolicy[],
	devices: IntuneManagedDevice[],
): IntuneFinding[] {
	const out: IntuneFinding[] = [];

	const unassigned = policies.filter((p) => p.assignmentCount === 0);
	if (unassigned.length > 0) {
		out.push({
			id: 'INTUNE-POL-001',
			severity: 'high',
			category: 'compliance-policy',
			title: `${unassigned.length} compliance polic${unassigned.length === 1 ? 'y' : 'ies'} with no assignments`,
			detail: 'Policies exist in tenant but are not assigned to any group — they have zero effect on device compliance state.',
			remediation: 'Intune → Devices → Compliance policies → click each → Assignments → add target group (typically "All users" or device group).',
			affectedCount: unassigned.length,
		});
	}

	const platformsInUse = new Set(devices.map((d) => d.operatingSystem));
	const platformsCovered = new Set(policies.flatMap((p) => p.assignmentCount > 0 ? [p.platform] : []));
	const uncovered: IntuneOs[] = [];
	for (const os of platformsInUse) {
		if (os === 'Unknown' || os === 'Linux') continue;
		if (!platformsCovered.has(os)) uncovered.push(os);
	}
	if (uncovered.length > 0) {
		out.push({
			id: 'INTUNE-POL-002',
			severity: 'high',
			category: 'compliance-policy',
			title: `No assigned compliance policy for: ${uncovered.join(', ')}`,
			detail: `Devices on ${uncovered.join(', ')} are enrolled but no compliance policy targets that platform — they default to compliant regardless of state.`,
			remediation: 'Create one compliance policy per platform with: minimum OS, encryption required, password required, no jailbreak/root, threat scan if available.',
			affectedCount: uncovered.length,
		});
	}

	return out;
}

export function evaluateAppProtectionFindings(
	policies: IntuneAppProtectionPolicy[],
	devices: IntuneManagedDevice[],
): IntuneFinding[] {
	const out: IntuneFinding[] = [];
	const platforms = new Set(devices.map((d) => d.operatingSystem));
	const mobileInUse: ('iOS' | 'Android')[] = [];
	if (platforms.has('iOS')) mobileInUse.push('iOS');
	if (platforms.has('Android')) mobileInUse.push('Android');

	for (const platform of mobileInUse) {
		const matching = policies.filter((p) => p.platform === platform);
		if (matching.length === 0) {
			out.push({
				id: `INTUNE-MAM-${platform.toUpperCase()}-001`,
				severity: 'high',
				category: 'app-protection',
				title: `No App Protection (MAM) policies for ${platform}`,
				detail: `${platform} devices in fleet but no MAM policies — corporate data inside Outlook/Teams/OneDrive can be copy-pasted to personal apps.`,
				remediation: 'Intune → Apps → App protection policies → Create policy → target: "All apps" with corporate data → require PIN, encrypt, block backup, restrict cut/copy/paste.',
				affectedCount: 1,
			});
			continue;
		}
		const noPin = matching.filter((p) => !p.pinRequired);
		const noEncrypt = matching.filter((p) => !p.encryptAppData);
		if (noPin.length > 0) {
			out.push({
				id: `INTUNE-MAM-${platform.toUpperCase()}-002`,
				severity: 'medium',
				category: 'app-protection',
				title: `${noPin.length} ${platform} MAM polic${noPin.length === 1 ? 'y' : 'ies'} without PIN requirement`,
				detail: 'App PIN not required — anyone with device unlock can access corporate apps.',
				remediation: 'Edit policy → Access requirements → "PIN for access" = Required, complexity = Numeric (6+) or Alphanumeric.',
				affectedCount: noPin.length,
			});
		}
		if (noEncrypt.length > 0) {
			out.push({
				id: `INTUNE-MAM-${platform.toUpperCase()}-003`,
				severity: 'high',
				category: 'app-protection',
				title: `${noEncrypt.length} ${platform} MAM polic${noEncrypt.length === 1 ? 'y' : 'ies'} without app-data encryption`,
				detail: 'App data encryption not required — corporate files cached by managed apps are unencrypted on device storage.',
				remediation: 'Edit policy → Data protection → "Encrypt app data" = Required.',
				affectedCount: noEncrypt.length,
			});
		}
	}

	return out;
}
