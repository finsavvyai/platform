import { describe, it, expect, beforeEach } from 'vitest';
import { SmartRouter, type Pathway, type PathwayStats } from './smart-router';

/** In-memory KV mock. */
function createMockKV(): KVNamespace {
	const store = new Map<string, { value: string; expiration?: number }>();
	return {
		get: async (key: string) => store.get(key)?.value ?? null,
		put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
			store.set(key, { value, expiration: opts?.expirationTtl });
		},
		delete: async (key: string) => { store.delete(key); },
		list: async (opts?: { prefix?: string }) => {
			const prefix = opts?.prefix ?? '';
			const keys = [...store.keys()]
				.filter((k) => k.startsWith(prefix))
				.map((name) => ({ name, expiration: undefined, metadata: undefined }));
			return { keys, list_complete: true, caches: [], cursor: '' };
		},
		getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
	} as unknown as KVNamespace;
}

describe('SmartRouter', () => {
	let kv: KVNamespace;
	let router: SmartRouter;

	beforeEach(() => {
		kv = createMockKV();
		router = new SmartRouter(kv);
	});

	it('routes to cheapest available pathway with no stats', async () => {
		const decision = await router.route('ask', ['claw-gateway', 'anthropic']);
		expect(decision.pathway).toBe('claw-gateway');
		expect(decision.fallbacks).toEqual(['anthropic']);
		expect(decision.reason).toContain('insufficient data');
	});

	it('routes to booster when available (zero cost)', async () => {
		const decision = await router.route('ask', ['booster', 'cache', 'anthropic']);
		expect(decision.pathway).toBe('booster');
	});

	it('avoids pathway with low success rate after enough samples', async () => {
		// Record 10 failures for claw-gateway
		for (let i = 0; i < 10; i++) {
			await router.recordOutcome('claw-gateway', 'ask', false, 500, 0.002);
		}
		// Record 10 successes for anthropic
		for (let i = 0; i < 10; i++) {
			await router.recordOutcome('anthropic', 'ask', true, 300, 0.008);
		}

		const decision = await router.route('ask', ['claw-gateway', 'anthropic']);
		expect(decision.pathway).toBe('anthropic');
		expect(decision.reason).toContain('100%');
	});

	it('prefers cheaper pathway when both are reliable', async () => {
		for (let i = 0; i < 10; i++) {
			await router.recordOutcome('claw-gateway', 'ask', true, 200, 0.002);
			await router.recordOutcome('anthropic', 'ask', true, 300, 0.008);
		}

		const decision = await router.route('ask', ['claw-gateway', 'anthropic']);
		expect(decision.pathway).toBe('claw-gateway');
	});

	it('records outcome and updates running averages', async () => {
		await router.recordOutcome('anthropic', 'scan', true, 100, 0.01);
		await router.recordOutcome('anthropic', 'scan', true, 200, 0.02);

		const stats = await router.getStats();
		const s = stats['scan']?.['anthropic'];
		expect(s).toBeDefined();
		expect(s!.successCount).toBe(2);
		expect(s!.failCount).toBe(0);
		expect(s!.avgLatencyMs).toBe(150);
		expect(s!.avgTokenCost).toBeCloseTo(0.015);
	});

	it('records failures correctly', async () => {
		await router.recordOutcome('anthropic', 'ask', false, 5000, 0);

		const stats = await router.getStats();
		const s = stats['ask']?.['anthropic'];
		expect(s).toBeDefined();
		expect(s!.failCount).toBe(1);
		expect(s!.successCount).toBe(0);
	});

	it('getStats returns empty object when no data', async () => {
		const stats = await router.getStats();
		expect(stats).toEqual({});
	});

	it('fallback chain contains all other pathways in cost order', async () => {
		const all: Pathway[] = ['booster', 'cache', 'claw-gateway', 'anthropic', 'openclaw'];
		const decision = await router.route('ask', all);
		expect(decision.pathway).toBe('booster');
		expect(decision.fallbacks).toHaveLength(4);
		expect(decision.fallbacks).toContain('anthropic');
	});

	it('handles single available pathway', async () => {
		const decision = await router.route('scan', ['anthropic']);
		expect(decision.pathway).toBe('anthropic');
		expect(decision.fallbacks).toEqual([]);
	});
});
