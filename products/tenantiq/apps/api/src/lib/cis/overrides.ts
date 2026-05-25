/**
 * CIS tenant overrides — load + apply (Phase 2 / leverage-ScubaGear).
 *
 * Pure logic so unit tests can exercise the applier without DB.
 */

import type { CisTenantOverride } from '@tenantiq/shared';
import type { ControlResult, ScanResult } from './scanner-types';

export type OverrideMap = Map<string, CisTenantOverride>;

export function indexOverrides(rows: CisTenantOverride[], now = new Date()): OverrideMap {
	const map: OverrideMap = new Map();
	for (const o of rows) {
		if (o.expiresAt && new Date(o.expiresAt) <= now) continue;
		map.set(o.controlId, o);
	}
	return map;
}

export async function loadOverrides(
	db: D1Database,
	tenantId: string,
	now = new Date(),
): Promise<OverrideMap> {
	const res = await db
		.prepare(
			`SELECT id, tenant_id AS tenantId, control_id AS controlId, decision,
              justification, expires_at AS expiresAt, created_at AS createdAt,
              created_by AS createdBy
       FROM cis_tenant_overrides WHERE tenant_id = ?`,
		)
		.bind(tenantId)
		.all<CisTenantOverride>()
		.catch(() => ({ results: [] as CisTenantOverride[] }));
	return indexOverrides(res.results ?? [], now);
}

/**
 * Re-shape a ScanResult by applying overrides:
 *  - omit:          remove from controls, push onto omittedControls, recompute totals.
 *  - accepted_risk: flip status to 'pass', preserve original on overrideApplied.
 *
 * `runEvaluation` already produced totals; we recompute from scratch to keep them
 * consistent under either decision.
 */
export function applyOverrides(scan: ScanResult, overrides: OverrideMap): ScanResult {
	if (overrides.size === 0) return scan;

	const omitted: ControlResult[] = [];
	const kept: ControlResult[] = [];

	for (const c of scan.controls) {
		const ov = overrides.get(c.controlId);
		if (!ov) {
			kept.push(c);
			continue;
		}
		if (ov.decision === 'omit') {
			omitted.push({ ...c, overrideApplied: { decision: 'omit', justification: ov.justification, originalStatus: c.status } });
			continue;
		}
		// accepted_risk
		kept.push({
			...c,
			status: 'pass',
			overrideApplied: { decision: 'accepted_risk', justification: ov.justification, originalStatus: c.status },
		});
	}

	const passCount = kept.filter(c => c.status === 'pass').length;
	const failCount = kept.filter(c => c.status === 'fail').length;
	const partialCount = kept.filter(c => c.status === 'partial').length;
	const errorCount = kept.filter(c => c.status === 'error').length;

	const sectionScores: ScanResult['sectionScores'] = {};
	for (const c of kept) {
		const s = (sectionScores[c.section] ??= { pass: 0, fail: 0, total: 0, score: 0 });
		s.total += 1;
		if (c.status === 'pass') s.pass += 1;
		if (c.status === 'fail') s.fail += 1;
	}
	for (const s of Object.values(sectionScores)) {
		s.score = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
	}

	const overallScore = kept.length > 0 ? Math.round(((passCount + partialCount * 0.5) / kept.length) * 100) : 0;

	return {
		...scan,
		overallScore,
		passCount,
		failCount,
		partialCount,
		errorCount,
		totalControls: kept.length,
		sectionScores,
		controls: kept,
		omittedControls: omitted,
	};
}
