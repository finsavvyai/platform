/**
 * Fetch real Microsoft Secure Score from Graph Security API.
 * Falls back to computed score if Graph call fails.
 */

export interface SecureScoreResult {
	current: number;
	max: number;
	percentage: number;
	trend: number[];
	source: 'graph' | 'computed';
	fetchedAt: string;
}

export async function fetchSecureScore(
	graphFetch: (path: string) => Promise<any>,
	kv: KVNamespace,
	tenantId: string,
): Promise<SecureScoreResult> {
	const now = new Date().toISOString();

	// Try Graph Security API first
	try {
		const data = await graphFetch('/security/secureScores?$top=7&$orderby=createdDateTime desc');
		const scores = data.value || [];

		if (scores.length > 0) {
			const latest = scores[0];
			const current = latest.currentScore ?? 0;
			const max = latest.maxScore ?? 100;
			const percentage = max > 0 ? Math.round((current / max) * 100) : 0;
			const trend = scores.slice(0, 7).map((s: any) =>
				s.maxScore > 0 ? Math.round((s.currentScore / s.maxScore) * 100) : 0
			).reverse();

			const result: SecureScoreResult = { current, max, percentage, trend, source: 'graph', fetchedAt: now };

			// Cache in KV for 1 hour
			await kv.put(`securescore:${tenantId}`, JSON.stringify({ current: percentage, trend }), { expirationTtl: 3600 });

			return result;
		}
	} catch (err) {
		console.log('[SecureScore] Graph API failed, using computed score:', err instanceof Error ? err.message : err);
	}

	// Fallback: return cached or null
	const cached = await kv.get(`securescore:${tenantId}`, 'json') as { current?: number; trend?: number[] } | null;
	if (cached?.current != null) {
		return { current: cached.current, max: 100, percentage: cached.current, trend: cached.trend || [], source: 'computed', fetchedAt: now };
	}

	return { current: 0, max: 100, percentage: 0, trend: [], source: 'computed', fetchedAt: now };
}
