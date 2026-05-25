/**
 * Semantic Cache — fuzzy question matching for AI /ask endpoint.
 *
 * Extends the exact-hash cache with normalization and stemming
 * so "How many licenses do we have?" matches "how many license".
 */

const CACHE_PREFIX = 'sem-cache:';
const FUZZY_PREFIX = 'sem-fuzzy:';
const CACHE_TTL = 4 * 3600; // 4 hours

/** Common English stop words to strip before hashing. */
const STOP_WORDS = new Set([
	'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
	'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
	'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'that',
	'this', 'it', 'its', 'we', 'our', 'i', 'my', 'me',
]);

/** Simple plural/verb stemming rules. */
const STEM_RULES: [RegExp, string][] = [
	[/ies$/i, 'y'],
	[/sses$/i, 'ss'],
	[/([^s])s$/i, '$1'],
	[/ing$/i, ''],
	[/ed$/i, ''],
	[/tion$/i, 'te'],
];

function stem(word: string): string {
	for (const [pattern, replacement] of STEM_RULES) {
		if (pattern.test(word)) return word.replace(pattern, replacement);
	}
	return word;
}

/** Normalize a question: lowercase, strip punctuation, remove stop words, stem. */
export function normalizeQuestion(question: string): string {
	const words = question
		.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.filter((w) => w.length > 1 && !STOP_WORDS.has(w))
		.map(stem);
	return words.sort().join(' ');
}

/** Fast non-crypto hash for cache keys. */
function fastHash(input: string): string {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) - h + input.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(36);
}

/** Generate a fingerprint from a normalized question. */
export function questionFingerprint(question: string): string {
	return fastHash(normalizeQuestion(question));
}

interface CacheEntry<T> {
	result: T;
	cachedAt: number;
	normalizedQuestion: string;
}

function exactKey(tenantId: string, question: string): string {
	return `${CACHE_PREFIX}${tenantId}:${fastHash(question)}`;
}

function fuzzyKey(tenantId: string, question: string): string {
	return `${FUZZY_PREFIX}${tenantId}:${questionFingerprint(question)}`;
}

/** Look up a cached answer — tries exact match first, then fuzzy. */
export async function getSemanticCache<T>(
	kv: KVNamespace,
	tenantId: string,
	question: string,
): Promise<{ result: T; similarity: 'exact' | 'fuzzy'; cachedAt: number } | null> {
	// Exact match
	const exactRaw = await kv.get(exactKey(tenantId, question), 'text');
	if (exactRaw) {
		try {
			const entry = JSON.parse(exactRaw) as CacheEntry<T>;
			return { result: entry.result, similarity: 'exact', cachedAt: entry.cachedAt };
		} catch { /* fall through */ }
	}

	// Fuzzy match via normalized fingerprint
	const fuzzyRaw = await kv.get(fuzzyKey(tenantId, question), 'text');
	if (fuzzyRaw) {
		try {
			const entry = JSON.parse(fuzzyRaw) as CacheEntry<T>;
			return { result: entry.result, similarity: 'fuzzy', cachedAt: entry.cachedAt };
		} catch { /* fall through */ }
	}

	return null;
}

/** Store an answer under both exact and fuzzy keys. */
export async function setSemanticCache<T>(
	kv: KVNamespace,
	tenantId: string,
	question: string,
	result: T,
): Promise<void> {
	const entry: CacheEntry<T> = {
		result,
		cachedAt: Date.now(),
		normalizedQuestion: normalizeQuestion(question),
	};
	const json = JSON.stringify(entry);
	const opts = { expirationTtl: CACHE_TTL };

	await Promise.all([
		kv.put(exactKey(tenantId, question), json, opts),
		kv.put(fuzzyKey(tenantId, question), json, opts),
	]);
}

/** Pre-cache common question patterns for a tenant. */
export function getCommonQuestions(): string[] {
	return [
		'How many licenses do we have?',
		'How many users are active?',
		'What is our security score?',
		'Show MFA status',
		'How many guest users?',
		'License usage summary',
		'What security issues do we have?',
		'Show inactive users',
	];
}
