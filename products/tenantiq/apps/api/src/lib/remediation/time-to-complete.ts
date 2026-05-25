/**
 * Time-to-complete estimator (T2.3).
 *
 * Replaces hardcoded literals like "5-10 minutes" / "15-30 minutes" with
 * actual median + p90 durations derived from the remediation_log table.
 *
 * Cache: 6h in KV per (org_id, action_type) to avoid hammering D1.
 *
 * Falls back to literal defaults when fewer than MIN_SAMPLES historical
 * runs exist — and explicitly flags the response with `historicalSamples`
 * so callers (and the UI) know whether the number is grounded.
 */

const MIN_SAMPLES = 5;
const CACHE_TTL_SECONDS = 6 * 60 * 60;

export interface TimeEstimate {
	displayMinutes: string;       // human-friendly: "8" or "5-12"
	medianMinutes: number | null; // null when no samples
	p90Minutes: number | null;
	historicalSamples: number;
	source: 'historical' | 'default';
}

const SEVERITY_DEFAULTS: Record<'critical' | 'high' | 'medium' | 'low', TimeEstimate> = {
	critical: { displayMinutes: '5-10', medianMinutes: null, p90Minutes: null, historicalSamples: 0, source: 'default' },
	high:     { displayMinutes: '10-20', medianMinutes: null, p90Minutes: null, historicalSamples: 0, source: 'default' },
	medium:   { displayMinutes: '15-30', medianMinutes: null, p90Minutes: null, historicalSamples: 0, source: 'default' },
	low:      { displayMinutes: '20-45', medianMinutes: null, p90Minutes: null, historicalSamples: 0, source: 'default' },
};

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	// Nearest-rank percentile (NIST): rank = ceil(p * N), 1-indexed.
	const rank = Math.max(1, Math.ceil(p * sorted.length));
	return sorted[Math.min(sorted.length - 1, rank - 1)];
}

function format(median: number, p90: number): string {
	const m = Math.max(1, Math.round(median / 60));
	const h = Math.max(m, Math.round(p90 / 60));
	return m === h ? `${m}` : `${m}-${h}`;
}

interface DbLike {
	prepare(sql: string): {
		bind(...args: unknown[]): {
			all<T>(): Promise<{ results: T[] }>;
		};
	};
}

interface KvLike {
	get(key: string, type?: 'json'): Promise<string | null>;
	put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>;
}

interface RemediationDurationRow {
	duration_seconds: number | null;
}

/**
 * Fetch median + p90 duration for an action across all completed runs in
 * the org. Returns null when fewer than MIN_SAMPLES samples exist.
 */
async function fetchDuration(
	db: DbLike,
	orgId: string,
	actionType: string,
): Promise<{ median: number; p90: number; samples: number } | null> {
	const rows = await db
		.prepare(
			`SELECT (julianday(completed_at) - julianday(started_at)) * 86400 AS duration_seconds
			 FROM remediation_log
			 WHERE org_id = ? AND action_type = ? AND status = 'completed'
			   AND started_at IS NOT NULL AND completed_at IS NOT NULL
			 ORDER BY completed_at DESC LIMIT 100`,
		)
		.bind(orgId, actionType)
		.all<RemediationDurationRow>()
		.catch(() => ({ results: [] as RemediationDurationRow[] }));

	const durations = (rows.results ?? [])
		.map(r => r.duration_seconds)
		.filter((d): d is number => typeof d === 'number' && d > 0 && d < 24 * 3600);

	if (durations.length < MIN_SAMPLES) return null;

	durations.sort((a, b) => a - b);
	return {
		median: percentile(durations, 0.5),
		p90: percentile(durations, 0.9),
		samples: durations.length,
	};
}

export async function estimateTimeToComplete(
	db: DbLike,
	kv: KvLike | null,
	orgId: string,
	actionType: string,
	severity: 'critical' | 'high' | 'medium' | 'low',
): Promise<TimeEstimate> {
	const cacheKey = `tte:${orgId}:${actionType}`;
	if (kv) {
		const cached = await kv.get(cacheKey).catch(() => null);
		if (cached) {
			try { return JSON.parse(cached) as TimeEstimate; } catch { /* fall through */ }
		}
	}

	const stats = await fetchDuration(db, orgId, actionType);
	const result: TimeEstimate = stats
		? {
			displayMinutes: format(stats.median, stats.p90),
			medianMinutes: Math.round(stats.median / 60),
			p90Minutes: Math.round(stats.p90 / 60),
			historicalSamples: stats.samples,
			source: 'historical',
		}
		: SEVERITY_DEFAULTS[severity];

	if (kv && stats) {
		await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS }).catch(() => {});
	}

	return result;
}

/**
 * Pure helper exported for tests + estimators that already have the durations.
 */
export function summarizeDurations(durationSeconds: number[], severity: 'critical' | 'high' | 'medium' | 'low'): TimeEstimate {
	const valid = durationSeconds.filter(d => typeof d === 'number' && d > 0 && d < 24 * 3600);
	if (valid.length < MIN_SAMPLES) return SEVERITY_DEFAULTS[severity];
	valid.sort((a, b) => a - b);
	const median = percentile(valid, 0.5);
	const p90 = percentile(valid, 0.9);
	return {
		displayMinutes: format(median, p90),
		medianMinutes: Math.round(median / 60),
		p90Minutes: Math.round(p90 / 60),
		historicalSamples: valid.length,
		source: 'historical',
	};
}
