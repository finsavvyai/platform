/**
 * Copilot readiness history — KV-backed for fast reads.
 * DB is source of truth; this provides cached fast access.
 */

import type { ReadinessResult, HistoryEntry, CategoryKey } from './copilot/readiness-types';

const MAX_HISTORY = 20;
const TTL_SECONDS = 365 * 24 * 60 * 60;

function kvKey(tenantId: string): string {
	return `copilot-history:${tenantId}`;
}

export async function appendReadinessHistory(
	kv: KVNamespace,
	tenantId: string,
	result: ReadinessResult,
): Promise<void> {
	const existing = await getReadinessHistory(kv, tenantId);
	const catScores = Object.fromEntries(
		Object.entries(result.categories).map(([k, v]) => [k, v.score]),
	) as Record<CategoryKey, number>;

	const entry: HistoryEntry = {
		id: crypto.randomUUID(),
		score: result.overallScore,
		categoryScores: catScores,
		assessedAt: result.assessedAt,
	};

	existing.push(entry);
	const trimmed = existing.slice(-MAX_HISTORY);
	await kv.put(kvKey(tenantId), JSON.stringify(trimmed), { expirationTtl: TTL_SECONDS });
}

export async function getReadinessHistory(
	kv: KVNamespace,
	tenantId: string,
): Promise<HistoryEntry[]> {
	const raw = await kv.get(kvKey(tenantId), 'json') as HistoryEntry[] | null;
	return raw ?? [];
}
