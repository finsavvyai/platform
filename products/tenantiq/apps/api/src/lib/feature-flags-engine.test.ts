import { describe, expect, it, beforeEach } from 'vitest';
import { FeatureFlagEngine, type FeatureFlag } from './feature-flags-engine';

/* ── In-memory KV mock ─────────────────────────────────────────── */

function createMockKV(): KVNamespace {
	const store = new Map<string, string>();
	return {
		get: async (key: string, type?: string) => {
			const raw = store.get(key) ?? null;
			if (raw === null) return null;
			return type === 'json' ? JSON.parse(raw) : raw;
		},
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
		delete: async (key: string) => {
			store.delete(key);
		},
		list: async (opts?: { prefix?: string }) => {
			const prefix = opts?.prefix ?? '';
			const keys = [...store.keys()]
				.filter((k) => k.startsWith(prefix))
				.map((name) => ({ name, expiration: 0, metadata: null }));
			return { keys, list_complete: true, cacheStatus: null };
		},
		getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
	} as unknown as KVNamespace;
}

/* ── Helpers ────────────────────────────────────────────────────── */

function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
	return {
		key: 'test-flag',
		enabled: true,
		description: 'Test flag',
		rolloutPercentage: 100,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	};
}

const defaultCtx = { orgId: 'org-1', plan: 'professional', userId: 'u-1' };

/* ── Tests ──────────────────────────────────────────────────────── */

describe('FeatureFlagEngine', () => {
	let kv: KVNamespace;
	let engine: FeatureFlagEngine;

	beforeEach(() => {
		kv = createMockKV();
		engine = new FeatureFlagEngine(kv);
	});

	describe('isEnabled', () => {
		it('returns false when flag does not exist', async () => {
			expect(await engine.isEnabled('missing', defaultCtx)).toBe(false);
		});

		it('returns false when flag is disabled', async () => {
			await engine.setFlag(makeFlag({ enabled: false }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(false);
		});

		it('returns true when flag is enabled with 100% rollout', async () => {
			await engine.setFlag(makeFlag());
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(true);
		});

		it('returns false when orgId not in targetOrgs', async () => {
			await engine.setFlag(makeFlag({ targetOrgs: ['org-other'] }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(false);
		});

		it('returns true when orgId is in targetOrgs', async () => {
			await engine.setFlag(makeFlag({ targetOrgs: ['org-1', 'org-2'] }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(true);
		});

		it('returns false when plan not in targetPlans', async () => {
			await engine.setFlag(makeFlag({ targetPlans: ['enterprise'] }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(false);
		});

		it('returns true when plan is in targetPlans', async () => {
			await engine.setFlag(makeFlag({ targetPlans: ['professional'] }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(true);
		});

		it('respects rollout percentage — deterministic per org', async () => {
			await engine.setFlag(makeFlag({ rolloutPercentage: 50 }));
			// Same context should always yield the same result
			const r1 = await engine.isEnabled('test-flag', defaultCtx);
			const r2 = await engine.isEnabled('test-flag', defaultCtx);
			expect(r1).toBe(r2);
		});

		it('returns false when rollout is 0%', async () => {
			await engine.setFlag(makeFlag({ rolloutPercentage: 0 }));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(false);
		});

		it('combines org + plan + rollout targeting', async () => {
			await engine.setFlag(makeFlag({
				targetOrgs: ['org-1'],
				targetPlans: ['professional'],
				rolloutPercentage: 100,
			}));
			expect(await engine.isEnabled('test-flag', defaultCtx)).toBe(true);

			// Wrong org
			expect(await engine.isEnabled('test-flag', {
				...defaultCtx, orgId: 'org-wrong',
			})).toBe(false);
		});
	});

	describe('CRUD operations', () => {
		it('setFlag + getFlag round-trips', async () => {
			const flag = makeFlag({ key: 'crud-test', description: 'CRUD' });
			await engine.setFlag(flag);
			const stored = await engine.getFlag('crud-test');
			expect(stored).not.toBeNull();
			expect(stored!.key).toBe('crud-test');
			expect(stored!.description).toBe('CRUD');
		});

		it('setFlag preserves createdAt on update', async () => {
			await engine.setFlag(makeFlag({ key: 'ts-test', createdAt: 1000 }));
			const first = await engine.getFlag('ts-test');
			await engine.setFlag(makeFlag({ key: 'ts-test', description: 'v2' }));
			const second = await engine.getFlag('ts-test');
			expect(second!.createdAt).toBe(first!.createdAt);
			expect(second!.description).toBe('v2');
		});

		it('deleteFlag removes a flag', async () => {
			await engine.setFlag(makeFlag());
			await engine.deleteFlag('test-flag');
			expect(await engine.getFlag('test-flag')).toBeNull();
		});

		it('listFlags returns all flags', async () => {
			await engine.setFlag(makeFlag({ key: 'a' }));
			await engine.setFlag(makeFlag({ key: 'b' }));
			const flags = await engine.listFlags();
			expect(flags).toHaveLength(2);
			const keys = flags.map((f) => f.key);
			expect(keys).toContain('a');
			expect(keys).toContain('b');
		});
	});

	describe('seedDefaults', () => {
		it('seeds flags that do not exist', async () => {
			const defaults = [makeFlag({ key: 'x' }), makeFlag({ key: 'y' })];
			const count = await engine.seedDefaults(defaults);
			expect(count).toBe(2);
			expect(await engine.getFlag('x')).not.toBeNull();
		});

		it('does not overwrite existing flags', async () => {
			await engine.setFlag(makeFlag({ key: 'x', description: 'custom' }));
			const defaults = [makeFlag({ key: 'x', description: 'default' })];
			const count = await engine.seedDefaults(defaults);
			expect(count).toBe(0);
			const flag = await engine.getFlag('x');
			expect(flag!.description).toBe('custom');
		});
	});
});
