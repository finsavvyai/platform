/**
 * Time-traveling state reconstruction for a tenant.
 *
 * Given a target timestamp, return the tenant's configuration *as it was*
 * at that moment. Algorithm:
 *
 *   1. Find the latest config_snapshot with captured_at <= target.
 *   2. Apply every config_drift between snapshot.captured_at and target,
 *      in detected_at order, mutating the snapshot's payload per drift's
 *      change descriptor.
 *   3. Read the audit_logs slice in [snapshot.captured_at, target] for
 *      narrative context (who did what when).
 *
 * Returns a {state, narrative, sources} bundle. Pure (no I/O outside the
 * D1 calls in fetchInputs); easy to test by feeding canned rows.
 */

export interface TimewarpInput {
	tenantId: string;
	at: number; // epoch ms
	snapshot: { id: string; captured_at: string; payload: string } | null;
	drifts: Array<{ id: string; category: string; severity: string; summary: string; metadata: string | null; detected_at: string }>;
	audits: Array<{ actor: string | null; action: string; resource_type: string | null; created_at: string }>;
}

export interface TimewarpResult {
	at: string;
	tenantId: string;
	baselineSnapshotId: string | null;
	baselineCapturedAt: string | null;
	driftsApplied: number;
	auditEvents: number;
	state: Record<string, unknown> | null;
	narrative: string[];
	sources: { snapshots: number; drifts: number; audits: number };
}

export function reconstruct(input: TimewarpInput): TimewarpResult {
	const atIso = new Date(input.at).toISOString();
	if (!input.snapshot) {
		return {
			at: atIso, tenantId: input.tenantId,
			baselineSnapshotId: null, baselineCapturedAt: null,
			driftsApplied: 0, auditEvents: input.audits.length,
			state: null,
			narrative: ['No config_snapshot captured before this timestamp — cannot reconstruct.'],
			sources: { snapshots: 0, drifts: input.drifts.length, audits: input.audits.length },
		};
	}

	let state: Record<string, unknown>;
	try {
		state = JSON.parse(input.snapshot.payload) as Record<string, unknown>;
	} catch {
		state = {};
	}

	let applied = 0;
	const sortedDrifts = [...input.drifts].sort(
		(a, b) => Date.parse(a.detected_at) - Date.parse(b.detected_at),
	);
	for (const d of sortedDrifts) {
		if (Date.parse(d.detected_at) > input.at) break;
		state = applyDrift(state, d);
		applied++;
	}

	const narrative = buildNarrative(input.snapshot.captured_at, atIso, applied, input.audits);

	return {
		at: atIso,
		tenantId: input.tenantId,
		baselineSnapshotId: input.snapshot.id,
		baselineCapturedAt: input.snapshot.captured_at,
		driftsApplied: applied,
		auditEvents: input.audits.length,
		state,
		narrative,
		sources: { snapshots: 1, drifts: input.drifts.length, audits: input.audits.length },
	};
}

function applyDrift(
	state: Record<string, unknown>,
	d: TimewarpInput['drifts'][number],
): Record<string, unknown> {
	const meta = safeJson(d.metadata);
	const category = (state[d.category] as Record<string, unknown> | undefined) ?? {};
	const after: Record<string, unknown> = {
		...state,
		[d.category]: {
			...category,
			lastChangeAt: d.detected_at,
			lastChange: d.summary,
			...(meta?.afterState && typeof meta.afterState === 'object'
				? { snapshot: meta.afterState }
				: {}),
		},
	};
	return after;
}

function buildNarrative(
	from: string, to: string, applied: number,
	audits: TimewarpInput['audits'],
): string[] {
	const lines: string[] = [];
	lines.push(`Reconstructed from snapshot at ${from} forward to ${to}.`);
	lines.push(`Applied ${applied} drift event${applied === 1 ? '' : 's'} in chronological order.`);
	if (audits.length === 0) {
		lines.push('No audit events in the window.');
	} else {
		const head = audits.slice(0, 5);
		lines.push(`${audits.length} audit event${audits.length === 1 ? '' : 's'} in window. First five:`);
		for (const a of head) {
			lines.push(`  · ${a.created_at} — ${a.actor ?? '?'} ${a.action}${a.resource_type ? ' on ' + a.resource_type : ''}`);
		}
		if (audits.length > 5) lines.push(`  · +${audits.length - 5} more`);
	}
	return lines;
}

function safeJson(s: string | null): Record<string, unknown> | null {
	if (!s) return null;
	try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}
