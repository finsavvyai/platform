/**
 * Drift attribution — matches detected config_drifts rows to M365 directoryAudit
 * entries by resource type + time window.
 *
 * Strategy:
 *  1. Bucket audit entries by category (mapped from activityDisplayName / category).
 *  2. For each drift, find the most-recent audit entry in the same bucket whose
 *     activityDateTime falls within ±windowMs of drift.detectedAt.
 *  3. If multiple match, prefer the one closest in time.
 *  4. Best-effort: drifts without a match return null and stay un-attributed.
 *
 * Pure function: no DB / no network. Caller fetches drifts + audits, runs match,
 * then UPDATEs config_drifts. Keeps this testable with fixtures.
 */

import type { DirectoryAuditEntry } from '../audit/m365-audit-fetcher';
import { actorFor, fetchDirectoryAudits } from '../audit/m365-audit-fetcher';

export interface DriftRow {
	id: string;
	category: string;
	detectedAt: string;
}

export interface AttributionMatch {
	driftId: string;
	auditId: string;
	actor: string;
	activityDateTime: string;
}

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Map a drift category (snapshot capture category id) to the audit log
 * category strings most likely to contain related events.
 *
 * Keys mirror the actual snapshot category ids in snapshot-types.ts
 * (CRITICAL_CATEGORIES + WARNING_CATEGORIES).
 *
 * Audit log category values come from the
 * `microsoft.graph.directoryAudit.category` enum:
 *   Policy, RoleManagement, ApplicationManagement, AuthenticationMethod,
 *   UserManagement, GroupManagement, DeviceManagement, Other
 */
const CATEGORY_AUDIT_MAP: Record<string, string[]> = {
	conditional_access: ['Policy'],
	authorization: ['RoleManagement'],
	security_defaults: ['Policy'],
	auth_methods: ['AuthenticationMethod', 'Policy'],
	app_consent: ['ApplicationManagement'],
	cross_tenant: ['Policy'],
	default: [],
};

function auditMatchesCategory(entry: DirectoryAuditEntry, driftCategory: string): boolean {
	const allowed = CATEGORY_AUDIT_MAP[driftCategory] ?? CATEGORY_AUDIT_MAP.default;
	if (allowed.length === 0) return true;
	return allowed.includes(entry.category);
}

/**
 * Match drifts to audit entries within ±windowMs.
 *
 * @returns Array of matches in arbitrary order. Drifts with no match are absent.
 */
export function attributeDrifts(
	drifts: DriftRow[],
	auditEntries: DirectoryAuditEntry[],
	windowMs: number = DEFAULT_WINDOW_MS,
): AttributionMatch[] {
	const matches: AttributionMatch[] = [];
	if (!Array.isArray(drifts) || drifts.length === 0) return matches;
	if (!Array.isArray(auditEntries) || auditEntries.length === 0) return matches;

	for (const drift of drifts) {
		const driftMs = Date.parse(drift.detectedAt);
		if (Number.isNaN(driftMs)) continue;

		let best: { entry: DirectoryAuditEntry; deltaMs: number } | null = null;
		for (const entry of auditEntries) {
			if (!auditMatchesCategory(entry, drift.category)) continue;
			const auditMs = Date.parse(entry.activityDateTime);
			if (Number.isNaN(auditMs)) continue;
			const delta = Math.abs(driftMs - auditMs);
			if (delta > windowMs) continue;
			if (!best || delta < best.deltaMs) best = { entry, deltaMs: delta };
		}

		if (best) {
			matches.push({
				driftId: drift.id,
				auditId: best.entry.id,
				actor: actorFor(best.entry),
				activityDateTime: best.entry.activityDateTime,
			});
		}
	}

	return matches;
}

/**
 * Apply attribution matches to the DB. Wraps the UPDATE pattern; caller
 * supplies the D1 binding so this stays driver-agnostic in tests.
 */
export async function persistAttributions(
	db: D1Database,
	matches: AttributionMatch[],
): Promise<number> {
	if (matches.length === 0) return 0;
	const stmt = db.prepare(
		`UPDATE config_drifts
		 SET attributed_to = ?, attributed_at = ?, audit_log_id = ?
		 WHERE id = ? AND audit_log_id IS NULL`,
	);
	let updated = 0;
	for (const m of matches) {
		const r = await stmt
			.bind(m.actor, m.activityDateTime, m.auditId, m.driftId)
			.run()
			.catch(() => null);
		if (r?.meta?.changes) updated++;
	}
	return updated;
}

/**
 * End-to-end attribution sweep — query unattributed drifts in the recent
 * window, fetch matching audit entries from Graph, attribute, persist.
 *
 * Designed to be safe to retry; UPDATEs only un-attributed rows so a second
 * call after audit-log lag (M365 emits 30–60 min late) catches what the
 * first call missed.
 */
export async function runAttribution(
	db: D1Database,
	graphFetch: (path: string) => Promise<unknown>,
	tenantId: string,
	since: Date,
): Promise<{ unattributed: number; matched: number; persisted: number }> {
	const rows = await db
		.prepare(
			`SELECT id, category, detected_at as detectedAt FROM config_drifts
			 WHERE tenant_id = ? AND audit_log_id IS NULL AND detected_at >= ?
			 ORDER BY detected_at DESC LIMIT 500`,
		)
		.bind(tenantId, since.toISOString())
		.all<DriftRow>()
		.catch(() => ({ results: [] as DriftRow[] }));

	const unattributed = rows.results ?? [];
	if (unattributed.length === 0) return { unattributed: 0, matched: 0, persisted: 0 };

	// Fetch audit window slightly wider than drift window to cover the ±5min match.
	const auditSince = new Date(since.getTime() - 10 * 60 * 1000);
	const audits = await fetchDirectoryAudits(graphFetch, auditSince).catch(() => [] as DirectoryAuditEntry[]);

	const matches = attributeDrifts(unattributed, audits);
	const persisted = await persistAttributions(db, matches);
	return { unattributed: unattributed.length, matched: matches.length, persisted };
}
