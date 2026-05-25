import { describe, it, expect, beforeEach } from 'vitest';
import {
	normalizeQuestion,
	questionFingerprint,
	getSemanticCache,
	setSemanticCache,
	getCommonQuestions,
} from './semantic-cache';

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

describe('normalizeQuestion', () => {
	it('lowercases and removes punctuation', () => {
		const result = normalizeQuestion('How Many Licenses?');
		expect(result).not.toContain('?');
		expect(result).toBe(result.toLowerCase());
	});

	it('removes stop words', () => {
		const result = normalizeQuestion('What is the security score for this tenant?');
		expect(result).not.toContain('the');
		expect(result).not.toContain('is');
		expect(result).not.toContain('for');
		expect(result).not.toContain('this');
	});

	it('stems plurals (licenses -> license)', () => {
		const result = normalizeQuestion('licenses');
		expect(result).toContain('license');
	});

	it('stems verb forms (running -> runn)', () => {
		const result = normalizeQuestion('running');
		expect(result).not.toContain('running');
	});

	it('produces sorted tokens for order-independence', () => {
		const a = normalizeQuestion('license count total');
		const b = normalizeQuestion('total license count');
		expect(a).toBe(b);
	});

	it('strips single-character words', () => {
		const result = normalizeQuestion('a b c long word');
		expect(result).not.toContain(' b ');
	});
});

describe('questionFingerprint', () => {
	it('produces same fingerprint for semantically similar questions', () => {
		const a = questionFingerprint('How many licenses do we have?');
		const b = questionFingerprint('how many license have');
		expect(a).toBe(b);
	});

	it('produces different fingerprint for different questions', () => {
		const a = questionFingerprint('How many licenses?');
		const b = questionFingerprint('What is the security score?');
		expect(a).not.toBe(b);
	});
});

describe('getSemanticCache / setSemanticCache', () => {
	let kv: KVNamespace;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('returns null on cache miss', async () => {
		const result = await getSemanticCache(kv, 't1', 'How many users?');
		expect(result).toBeNull();
	});

	it('returns exact match after set', async () => {
		await setSemanticCache(kv, 't1', 'How many users?', { count: 42 });
		const result = await getSemanticCache<{ count: number }>(kv, 't1', 'How many users?');
		expect(result).not.toBeNull();
		expect(result!.similarity).toBe('exact');
		expect(result!.result.count).toBe(42);
	});

	it('returns fuzzy match for similar question', async () => {
		await setSemanticCache(kv, 't1', 'How many licenses do we have?', 'answer');
		// Different phrasing, same normalized form
		const result = await getSemanticCache<string>(kv, 't1', 'how many license have');
		expect(result).not.toBeNull();
		expect(result!.similarity).toBe('fuzzy');
		expect(result!.result).toBe('answer');
	});

	it('isolates cache by tenant', async () => {
		await setSemanticCache(kv, 't1', 'How many users?', 'ten');
		const result = await getSemanticCache(kv, 't2', 'How many users?');
		expect(result).toBeNull();
	});

	it('stores cachedAt timestamp', async () => {
		const before = Date.now();
		await setSemanticCache(kv, 't1', 'test', 'val');
		const result = await getSemanticCache(kv, 't1', 'test');
		expect(result!.cachedAt).toBeGreaterThanOrEqual(before);
	});
});

describe('getCommonQuestions', () => {
	it('returns a non-empty array of strings', () => {
		const questions = getCommonQuestions();
		expect(questions.length).toBeGreaterThan(0);
		expect(typeof questions[0]).toBe('string');
	});
});
