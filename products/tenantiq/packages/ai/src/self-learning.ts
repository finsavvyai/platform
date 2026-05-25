/**
 * Self-Learning Store — KV-backed AI feedback loop.
 *
 * Tracks user feedback on AI recommendations, aggregates patterns,
 * and produces prompt enrichment for future AI calls.
 */

/** Minimal KV interface — avoids hard dependency on @cloudflare/workers-types */
export interface KVNamespace {
  get(key: string, type?: string): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

const FEEDBACK_PREFIX = 'sl:fb:';
const INSIGHT_PREFIX = 'sl:ins:';
const FEEDBACK_TTL = 90 * 24 * 3600; // 90 days
const INSIGHT_TTL = 24 * 3600; // 1 day cache
const MAX_ENTRIES_PER_BUCKET = 500;

export type FeedbackAction = 'helpful' | 'not_helpful' | 'applied' | 'dismissed';
export type TenantSizeBucket = 'small' | 'medium' | 'large';
export type AIOperation = 'security-scan' | 'license-optimize' | 'ask';

export interface FeedbackEntry {
	tenantId: string;
	operation: AIOperation;
	recommendationHash: string;
	action: FeedbackAction;
	tenantSize: TenantSizeBucket;
	timestamp: number;
}

export interface LearningInsight {
	topAcceptedPatterns: string[];
	topRejectedPatterns: string[];
	confidenceAdjustments: Record<string, number>;
}

/** Fast non-crypto hash — same algorithm as claw-cache.ts */
export function fastHash(input: string): string {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) - h + input.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(36);
}

/** Classify tenant by user count into size bucket. */
export function classifyTenantSize(userCount: number): TenantSizeBucket {
	if (userCount < 50) return 'small';
	if (userCount <= 500) return 'medium';
	return 'large';
}

function bucketKey(operation: string, tenantSize: string): string {
	return `${FEEDBACK_PREFIX}${operation}:${tenantSize}`;
}

function insightKey(operation: string, tenantSize: string): string {
	return `${INSIGHT_PREFIX}${operation}:${tenantSize}`;
}

export class SelfLearningStore {
	constructor(private kv: KVNamespace) {}

	/** Record user feedback on a recommendation. */
	async recordFeedback(entry: FeedbackEntry): Promise<void> {
		const key = bucketKey(entry.operation, entry.tenantSize);
		const existing = await this.kv.get(key, 'json') as FeedbackEntry[] | null;
		const entries = existing ?? [];
		entries.push(entry);

		// Keep only the most recent entries per bucket
		const trimmed = entries.length > MAX_ENTRIES_PER_BUCKET
			? entries.slice(-MAX_ENTRIES_PER_BUCKET)
			: entries;

		await this.kv.put(key, JSON.stringify(trimmed), { expirationTtl: FEEDBACK_TTL });

		// Invalidate cached insight so next read recalculates
		await this.kv.delete(insightKey(entry.operation, entry.tenantSize));
	}

	/** Aggregate feedback into learning insights for a given operation + size. */
	async getInsights(operation: string, tenantSize: string): Promise<LearningInsight> {
		const cacheKey = insightKey(operation, tenantSize);
		const cached = await this.kv.get(cacheKey, 'json') as LearningInsight | null;
		if (cached) return cached;

		const key = bucketKey(operation, tenantSize);
		const entries = (await this.kv.get(key, 'json') as FeedbackEntry[] | null) ?? [];

		const insight = computeInsights(entries);
		await this.kv.put(cacheKey, JSON.stringify(insight), { expirationTtl: INSIGHT_TTL });
		return insight;
	}

	/** Build a prompt enrichment string from aggregated feedback. */
	async buildPromptEnrichment(operation: string, tenantSize: string): Promise<string> {
		const insight = await this.getInsights(operation, tenantSize);
		const lines: string[] = [];

		if (insight.topAcceptedPatterns.length > 0) {
			lines.push(`Users in similar ${tenantSize} tenants found these recommendations helpful:`);
			for (const p of insight.topAcceptedPatterns.slice(0, 5)) {
				lines.push(`  - Recommendation ${p} was frequently accepted`);
			}
		}

		if (insight.topRejectedPatterns.length > 0) {
			lines.push(`These recommendations were frequently dismissed:`);
			for (const p of insight.topRejectedPatterns.slice(0, 3)) {
				lines.push(`  - Recommendation ${p} was often rejected`);
			}
		}

		return lines.length > 0
			? `\n--- Feedback Context ---\n${lines.join('\n')}\n--- End Feedback ---`
			: '';
	}
}

/** Pure function: compute insights from feedback entries. */
export function computeInsights(entries: FeedbackEntry[]): LearningInsight {
	const positive = new Map<string, number>();
	const negative = new Map<string, number>();

	for (const e of entries) {
		const hash = e.recommendationHash;
		if (e.action === 'helpful' || e.action === 'applied') {
			positive.set(hash, (positive.get(hash) ?? 0) + 1);
		} else {
			negative.set(hash, (negative.get(hash) ?? 0) + 1);
		}
	}

	const sortedPositive = [...positive.entries()].sort((a, b) => b[1] - a[1]);
	const sortedNegative = [...negative.entries()].sort((a, b) => b[1] - a[1]);

	const confidenceAdjustments: Record<string, number> = {};
	const allHashes = new Set([...positive.keys(), ...negative.keys()]);
	for (const hash of allHashes) {
		const pos = positive.get(hash) ?? 0;
		const neg = negative.get(hash) ?? 0;
		const total = pos + neg;
		if (total >= 3) {
			confidenceAdjustments[hash] = Math.round(((pos - neg) / total) * 100) / 100;
		}
	}

	return {
		topAcceptedPatterns: sortedPositive.slice(0, 10).map(([h]) => h),
		topRejectedPatterns: sortedNegative.slice(0, 10).map(([h]) => h),
		confidenceAdjustments,
	};
}
