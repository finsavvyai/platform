/**
 * PIM finding evaluators. Pure: take typed inputs, return findings array.
 * Split from scanner.ts so each file stays under 200 lines.
 */
import type { PimRoleAssignment, PimRoleDefinition } from '@tenantiq/graph';
import type { PimFinding, PimRolePrincipal } from './types';

export function evaluateStandingFindings(
	standing: PimRoleAssignment[],
	defs: Map<string, PimRoleDefinition>,
): PimFinding[] {
	const out: PimFinding[] = [];
	const standingPriv = standing.filter((a) => defs.get(a.roleDefinitionId)?.isPrivileged === true);
	if (standingPriv.length > 0) {
		out.push({
			id: 'PIM-STD-001',
			severity: 'critical',
			category: 'standing-access',
			title: `${standingPriv.length} standing privileged role assignment${standingPriv.length === 1 ? '' : 's'}`,
			detail: 'Standing (always-active) assignments to privileged roles. PIM JIT activation, MFA gate, and access review never applied — these accounts are persistent administrative attack surface.',
			remediation: 'Convert to PIM-eligible: Entra → Identity Governance → Privileged Identity Management → Microsoft Entra roles → assign as Eligible (not Active). Set max activation duration ≤ 8h, MFA on activation, justification required.',
			affectedCount: standingPriv.length,
			principals: standingPriv.slice(0, 25).map((a) => a.principalUpn ?? a.principalDisplayName ?? a.principalId),
			roles: Array.from(new Set(standingPriv.map((a) => defs.get(a.roleDefinitionId)?.displayName ?? a.roleDisplayName))),
		});
	}
	return out;
}

export function evaluatePerpetualFindings(allAssignments: PimRoleAssignment[]): PimFinding[] {
	const perpetual = allAssignments.filter((a) => a.endDateTime === null && a.principalType === 'user');
	if (perpetual.length === 0) return [];
	return [{
		id: 'PIM-EXP-001',
		severity: 'high',
		category: 'expiration',
		title: `${perpetual.length} role assignment${perpetual.length === 1 ? '' : 's'} with no expiration`,
		detail: 'Assignments without endDateTime never auto-expire. Access reviews and rotation policies cannot enforce — privileges accumulate over time.',
		remediation: 'PIM → Settings → set Maximum eligible duration ≤ 365d and Maximum active duration ≤ 8h. Existing perpetual assignments need re-creation with end-date.',
		affectedCount: perpetual.length,
		principals: perpetual.slice(0, 25).map((a) => a.principalUpn ?? a.principalDisplayName ?? a.principalId),
	}];
}

export function evaluateMfaFindings(principals: PimRolePrincipal[]): PimFinding[] {
	const privNoMfa = principals.filter((p) => p.principalType === 'user' && p.mfaRegistered === false);
	const unique = new Map(privNoMfa.map((p) => [p.principalId, p]));
	if (unique.size === 0) return [];
	return [{
		id: 'PIM-MFA-001',
		severity: 'critical',
		category: 'mfa',
		title: `${unique.size} privileged user${unique.size === 1 ? '' : 's'} without MFA registered`,
		detail: 'Users with directory role assignments have no registered MFA method. PIM activation requires MFA but if no method is enrolled the user can never re-authenticate — and standing assignments bypass MFA entirely.',
		remediation: 'Enforce MFA registration via CA policy "All users → require MFA registration". Reach out to listed accounts to enroll authenticator app.',
		affectedCount: unique.size,
		principals: Array.from(unique.values()).slice(0, 25).map((p) => p.principalUpn ?? p.principalDisplayName ?? p.principalId),
	}];
}

export function evaluateOverPrivilegedFindings(principals: PimRolePrincipal[]): PimFinding[] {
	const userRoleCount = new Map<string, Set<string>>();
	for (const p of principals) {
		if (p.principalType !== 'user') continue;
		const set = userRoleCount.get(p.principalId) ?? new Set();
		set.add(p.roleDefinitionId);
		userRoleCount.set(p.principalId, set);
	}
	const overPriv = Array.from(userRoleCount.entries()).filter(([, roles]) => roles.size >= 4);
	if (overPriv.length === 0) return [];
	const upnByPid = new Map(principals.map((p) => [p.principalId, p.principalUpn ?? p.principalDisplayName ?? p.principalId]));
	return [{
		id: 'PIM-OVR-001',
		severity: 'medium',
		category: 'over-privileged',
		title: `${overPriv.length} user${overPriv.length === 1 ? '' : 's'} with 4+ directory roles`,
		detail: 'Single account holds many directory roles — segregation of duties is collapsed. If credentials are phished, blast radius covers every assigned role.',
		remediation: 'Audit each: do they actually need every role? Replace with role-specific delegation, or require separate admin accounts per duty (per Microsoft tier 0/1/2 model).',
		affectedCount: overPriv.length,
		principals: overPriv.slice(0, 25).map(([pid]) => upnByPid.get(pid) ?? pid),
	}];
}
