import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	SelfLearningStore,
	fastHash,
	classifyTenantSize,
	computeInsights,
} from './self-learning';
import type { FeedbackEntry, TenantSizeBucket, KVNamespace } from './self-learning';

// ─── KV Mock ────────────────────────────────────────────────────────────────
const kvStore: Record<string, string> = {};
const mockKV = {
	get: vi.fn(async (key: string, format?: string) => {
		const val = kvStore[key];
		if (!val) return null;
		return format === 'json' ? JSON.parse(val) : val;
	}),
	put: vi.fn(async (key: string, value: string) => {
		kvStore[key] = value;
	}),
	delete: vi.fn(async (key: string) => {
		delete kvStore[key];
	}),
	list: vi.fn(),
	getWithMetadata: vi.fn(),
} as unknown as KVNamespace;

function clearKV() {
	Object.keys(kvStore).forEach((k) => delete kvStore[k]);
	vi.clearAllMocks();
}

function makeFeedback(overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
	return {
		tenantId: 'tenant-1',
		operation: 'security-scan',
		recommendationHash: fastHash('Enable MFA for all admins'),
		action: 'helpful',
		tenantSize: 'medium',
		timestamp: Date.now(),
		...overrides,
	};
}

// ─── Unit Tests ─────────────────────────────────────────────────────────────
describe('fastHash', () => {
	it('should produce consistent hashes', () => {
		expect(fastHash('hello')).toBe(fastHash('hello'));
	});

	it('should produce different hashes for different inputs', () => {
		expect(fastHash('hello')).not.toBe(fastHash('world'));
	});

	it('should return a base-36 string', () => {
		const hash = fastHash('test input');
		expect(/^[0-9a-z]+$/.test(hash)).toBe(true);
	});
});

describe('classifyTenantSize', () => {
	it('should classify <50 as small', () => {
		expect(classifyTenantSize(0)).toBe('small');
		expect(classifyTenantSize(49)).toBe('small');
	});

	it('should classify 50-500 as medium', () => {
		expect(classifyTenantSize(50)).toBe('medium');
		expect(classifyTenantSize(500)).toBe('medium');
	});

	it('should classify >500 as large', () => {
		expect(classifyTenantSize(501)).toBe('large');
		expect(classifyTenantSize(10000)).toBe('large');
	});
});

describe('computeInsights', () => {
	it('should return empty insights for no entries', () => {
		const insight = computeInsights([]);
		expect(insight.topAcceptedPatterns).toEqual([]);
		expect(insight.topRejectedPatterns).toEqual([]);
		expect(insight.confidenceAdjustments).toEqual({});
	});

	it('should rank accepted patterns by frequency', () => {
		const entries: FeedbackEntry[] = [
			makeFeedback({ recommendationHash: 'a', action: 'applied' }),
			makeFeedback({ recommendationHash: 'a', action: 'helpful' }),
			makeFeedback({ recommendationHash: 'b', action: 'helpful' }),
		];
		const insight = computeInsights(entries);
		expect(insight.topAcceptedPatterns[0]).toBe('a');
		expect(insight.topAcceptedPatterns[1]).toBe('b');
	});

	it('should rank rejected patterns by frequency', () => {
		const entries: FeedbackEntry[] = [
			makeFeedback({ recommendationHash: 'x', action: 'dismissed' }),
			makeFeedback({ recommendationHash: 'x', action: 'not_helpful' }),
			makeFeedback({ recommendationHash: 'y', action: 'dismissed' }),
		];
		const insight = computeInsights(entries);
		expect(insight.topRejectedPatterns[0]).toBe('x');
	});

	it('should compute confidence adjustments with >=3 feedback entries', () => {
		const entries: FeedbackEntry[] = [
			makeFeedback({ recommendationHash: 'c', action: 'helpful' }),
			makeFeedback({ recommendationHash: 'c', action: 'helpful' }),
			makeFeedback({ recommendationHash: 'c', action: 'dismissed' }),
		];
		const insight = computeInsights(entries);
		// (2 pos - 1 neg) / 3 = 0.33
		expect(insight.confidenceAdjustments['c']).toBeCloseTo(0.33, 1);
	});

	it('should not compute adjustment for <3 entries', () => {
		const entries: FeedbackEntry[] = [
			makeFeedback({ recommendationHash: 'd', action: 'helpful' }),
			makeFeedback({ recommendationHash: 'd', action: 'dismissed' }),
		];
		const insight = computeInsights(entries);
		expect(insight.confidenceAdjustments['d']).toBeUndefined();
	});
});

// ─── SelfLearningStore Integration ──────────────────────────────────────────
describe('SelfLearningStore', () => {
	let store: SelfLearningStore;

	beforeEach(() => {
		clearKV();
		store = new SelfLearningStore(mockKV);
	});

	it('should record feedback and persist to KV', async () => {
		await store.recordFeedback(makeFeedback());
		expect(mockKV.put).toHaveBeenCalledTimes(1);
		expect(mockKV.delete).toHaveBeenCalledTimes(1);
	});

	it('should retrieve insights from recorded feedback', async () => {
		await store.recordFeedback(makeFeedback({ action: 'helpful' }));
		await store.recordFeedback(makeFeedback({ action: 'applied' }));
		await store.recordFeedback(makeFeedback({ action: 'dismissed' }));

		const insights = await store.getInsights('security-scan', 'medium');
		expect(insights.topAcceptedPatterns.length).toBeGreaterThan(0);
	});

	it('should cache insights on second read', async () => {
		await store.recordFeedback(makeFeedback());
		await store.getInsights('security-scan', 'medium');
		const callsBefore = (mockKV.get as any).mock.calls.length;

		await store.getInsights('security-scan', 'medium');
		// Second call should hit cached insight (only 1 get for cache key)
		const callsAfter = (mockKV.get as any).mock.calls.length;
		expect(callsAfter - callsBefore).toBe(1);
	});

	it('should build prompt enrichment for accepted patterns', async () => {
		for (let i = 0; i < 3; i++) {
			await store.recordFeedback(makeFeedback({ action: 'applied' }));
		}

		const enrichment = await store.buildPromptEnrichment('security-scan', 'medium');
		expect(enrichment).toContain('Feedback Context');
		expect(enrichment).toContain('frequently accepted');
		expect(enrichment).toContain('medium');
	});

	it('should return empty string when no feedback exists', async () => {
		const enrichment = await store.buildPromptEnrichment('ask', 'small');
		expect(enrichment).toBe('');
	});

	it('should invalidate insight cache when new feedback is recorded', async () => {
		await store.recordFeedback(makeFeedback());
		await store.getInsights('security-scan', 'medium');
		await store.recordFeedback(makeFeedback({ action: 'dismissed' }));
		expect(mockKV.delete).toHaveBeenCalled();
	});
});
