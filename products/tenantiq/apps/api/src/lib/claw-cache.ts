/**
 * Claw Reasoning Cache — caches M365 tenant analysis results.
 *
 * Same tenant config produces the same analysis. Tenant configs change
 * infrequently, so a 4-hour TTL avoids redundant LLM calls.
 *
 * Cache key: SHA-256(tenant_id + analysis_type + context_hash)
 * Storage: Cloudflare KV with TTL expiration.
 */

const CACHE_TTL_SECONDS = 4 * 3600; // 4 hours
const CACHE_PREFIX = 'claw-cache:';

export type AnalysisType =
	| 'security-scan'
	| 'license-optimize'
	| 'ask'
	| 'chain:security-audit'
	| 'chain:compliance-check'
	| 'chain:cost-review'
	| 'chain:full-assessment';

interface CacheEntry<T> {
	result: T;
	cachedAt: number;
	contextHash: string;
}

/**
 * Hash tenant context to detect when the underlying data has changed.
 * Uses a fast string hash (not crypto) since this is a cache key, not security.
 */
function fastHash(input: string): string {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) - h + input.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(36);
}

function cacheKey(tenantId: string, analysisType: AnalysisType, contextHash: string): string {
	return `${CACHE_PREFIX}${tenantId}:${analysisType}:${contextHash}`;
}

/**
 * Get a cached analysis result. Returns null on miss.
 */
export async function getCachedAnalysis<T>(
	kv: KVNamespace,
	tenantId: string,
	analysisType: AnalysisType,
	contextStr: string,
): Promise<{ result: T; cachedAt: number } | null> {
	const hash = fastHash(contextStr);
	const key = cacheKey(tenantId, analysisType, hash);

	const raw = await kv.get(key, 'text');
	if (!raw) return null;

	try {
		const entry = JSON.parse(raw) as CacheEntry<T>;
		return { result: entry.result, cachedAt: entry.cachedAt };
	} catch {
		return null;
	}
}

/**
 * Store an analysis result in the cache.
 */
export async function setCachedAnalysis<T>(
	kv: KVNamespace,
	tenantId: string,
	analysisType: AnalysisType,
	contextStr: string,
	result: T,
): Promise<void> {
	const hash = fastHash(contextStr);
	const key = cacheKey(tenantId, analysisType, hash);
	const entry: CacheEntry<T> = { result, cachedAt: Date.now(), contextHash: hash };

	await kv.put(key, JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
}

/**
 * Invalidate all cached analyses for a tenant (e.g., after a sync).
 */
export async function invalidateTenantCache(
	kv: KVNamespace,
	tenantId: string,
): Promise<void> {
	const prefix = `${CACHE_PREFIX}${tenantId}:`;
	const list = await kv.list({ prefix });
	await Promise.all(list.keys.map((k) => kv.delete(k.name)));
}
