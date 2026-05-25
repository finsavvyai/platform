import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { getPerformanceSummary } from '../middleware/performance';
import { authMiddleware } from '../middleware/auth.middleware';
import { platformAdminMiddleware } from '../middleware/admin-auth';

export const metricsRoutes = new Hono<AppEnv>();

metricsRoutes.use('*', authMiddleware);
metricsRoutes.use('*', platformAdminMiddleware);

interface RateLimitStats {
	limitedCount: number;
	topIps: Record<string, number>;
	hour: string;
}

/** GET /metrics - internal metrics dashboard (admin-only recommended) */
metricsRoutes.get('/', async (c) => {
	const kv = c.env.KV;

	// API latency summary
	const perfSummary = await getPerformanceSummary(kv);

	// Rate limit stats
	let rateLimitStats: RateLimitStats | null = null;
	try {
		const raw = await kv.get('metrics:ratelimit:hourly');
		rateLimitStats = raw ? JSON.parse(raw) : null;
	} catch {
		/* best-effort */
	}

	// Cache hit rates (read from KV if stored by other middleware)
	let cacheStats: Record<string, unknown> | null = null;
	try {
		const raw = await kv.get('metrics:cache:summary');
		cacheStats = raw ? JSON.parse(raw) : null;
	} catch {
		/* best-effort */
	}

	return c.json({
		timestamp: new Date().toISOString(),
		version: c.env.APP_VERSION || '0.0.0-dev',
		environment: c.env.ENVIRONMENT || 'production',
		performance: perfSummary ?? {
			p50: 0,
			p95: 0,
			count: 0,
			lastUpdated: null
		},
		rateLimit: rateLimitStats ?? {
			limitedCount: 0,
			topIps: {},
			hour: null
		},
		cache: cacheStats
	});
});

/** POST /metrics/ratelimit - track a rate-limited request */
metricsRoutes.post('/ratelimit', async (c) => {
	const body = await c.req.json<{ ip: string }>();
	const kv = c.env.KV;
	const hour = new Date().toISOString().slice(0, 13);
	const key = 'metrics:ratelimit:hourly';

	let stats: RateLimitStats = { limitedCount: 0, topIps: {}, hour };
	try {
		const raw = await kv.get(key);
		if (raw) {
			const parsed = JSON.parse(raw) as RateLimitStats;
			stats = parsed.hour === hour ? parsed : stats;
		}
	} catch {
		/* fresh start */
	}

	stats.limitedCount++;
	const masked = body.ip.replace(/\.\d+$/, '.x');
	stats.topIps[masked] = (stats.topIps[masked] || 0) + 1;

	await kv.put(key, JSON.stringify(stats), { expirationTtl: 7200 });
	return c.json({ ok: true });
});
