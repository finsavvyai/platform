/**
 * PIM (Privileged Identity Management) audit scanner.
 *
 * Inputs are split: role definitions, standing (non-PIM) assignments,
 * eligible (PIM) assignments, active (PIM-activated) assignments, plus
 * an optional MFA registration lookup. Pure: no I/O, deterministic.
 *
 * Risk model:
 *   - Standing privileged role assignment is the core anti-pattern.
 *   - Perpetual assignments (no endDateTime) bypass access-review rotation.
 *   - Privileged principal without MFA is critical.
 *   - 4+ roles on one user breaks segregation of duties.
 */
import type { PimRoleAssignment, PimRoleDefinition } from '@tenantiq/graph';
import type {
	PimFinding,
	PimRolePrincipal,
	PimScanResult,
	PimSummary,
	PimMfaLookup,
} from './types';
import {
	evaluateStandingFindings,
	evaluatePerpetualFindings,
	evaluateMfaFindings,
	evaluateOverPrivilegedFindings,
} from './findings';

export type { PimFinding, PimScanResult, PimSummary, PimRolePrincipal, PimFindingSeverity } from './types';

export function assemblePimScan(input: {
	roleDefs: PimRoleDefinition[];
	standing: PimRoleAssignment[];
	eligible: PimRoleAssignment[];
	active: PimRoleAssignment[];
	mfaLookup?: PimMfaLookup;
}): PimScanResult {
	const { roleDefs, standing, eligible, active } = input;
	const mfaLookup = input.mfaLookup ?? (() => null);

	const defMap = new Map(roleDefs.map((d) => [d.id, d] as const));
	const principals = collectPrincipals([...standing, ...eligible, ...active], defMap, mfaLookup);
	const findings: PimFinding[] = [
		...evaluateStandingFindings(standing, defMap),
		...evaluatePerpetualFindings([...standing, ...eligible]),
		...evaluateMfaFindings(principals),
		...evaluateOverPrivilegedFindings(principals),
	];
	const summary = buildSummary(standing, eligible, active, principals, findings);
	return {
		scannedAt: new Date().toISOString(),
		summary,
		findings,
		principals,
	};
}

function collectPrincipals(
	assignments: PimRoleAssignment[],
	defs: Map<string, PimRoleDefinition>,
	mfaLookup: PimMfaLookup,
): PimRolePrincipal[] {
	return assignments.map((a) => {
		const def = defs.get(a.roleDefinitionId);
		return {
			principalId: a.principalId,
			principalUpn: a.principalUpn,
			principalDisplayName: a.principalDisplayName,
			principalType: a.principalType,
			roleDisplayName: def?.displayName ?? a.roleDisplayName,
			roleDefinitionId: a.roleDefinitionId,
			kind: a.kind,
			endDateTime: a.endDateTime,
			mfaRegistered: a.principalType === 'user' ? mfaLookup(a.principalId) : null,
		};
	});
}

function buildSummary(
	standing: PimRoleAssignment[],
	eligible: PimRoleAssignment[],
	active: PimRoleAssignment[],
	principals: PimRolePrincipal[],
	findings: PimFinding[],
): PimSummary {
	const total = standing.length + eligible.length + active.length;
	const privilegedPrincipals = new Set(
		principals.filter((p) => p.principalType === 'user').map((p) => p.principalId),
	);
	const standingPrivileged = findings.find((f) => f.id === 'PIM-STD-001')?.affectedCount ?? 0;
	const perpetual = findings.find((f) => f.id === 'PIM-EXP-001')?.affectedCount ?? 0;
	const mfaGap = findings.find((f) => f.id === 'PIM-MFA-001')?.affectedCount ?? 0;
	const postureScore = computePostureScore({
		total,
		standing: standing.length,
		standingPrivileged,
		perpetual,
		mfaGap,
		critical: findings.filter((f) => f.severity === 'critical').length,
		high: findings.filter((f) => f.severity === 'high').length,
	});
	return {
		totalAssignments: total,
		standingCount: standing.length,
		eligibleCount: eligible.length,
		activeCount: active.length,
		privilegedRolePrincipals: privilegedPrincipals.size,
		standingPrivileged,
		perpetualAssignments: perpetual,
		mfaGapCount: mfaGap,
		postureScore,
	};
}

function computePostureScore(input: {
	total: number; standing: number; standingPrivileged: number;
	perpetual: number; mfaGap: number; critical: number; high: number;
}): number {
	if (input.total === 0) return 100;
	const pimAdoption = 1 - input.standing / input.total;
	const base = Math.round(pimAdoption * 60 + 40);
	const penalty = input.standingPrivileged * 10 + input.perpetual * 3 + input.mfaGap * 8 + input.critical * 5 + input.high * 2;
	return Math.max(0, Math.min(100, base - penalty));
}
