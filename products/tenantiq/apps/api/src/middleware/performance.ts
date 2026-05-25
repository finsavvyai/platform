import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';
import { logger } from '../lib/logger';

const SLOW_REQUEST_MS = 1000;
const FLUSH_INTERVAL = 100;

let recentDurations: number[] = [];
let requestCount = 0;

/** Middleware that measures request duration and tracks performance. */
export const performanceMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const start = Date.now();
	await next();
	const duration = Date.now() - start;

	c.header('X-Response-Time', `${duration}ms`);

	if (duration > SLOW_REQUEST_MS) {
		logger.warn('Slow request detected', {
			path: c.req.path,
			method: c.req.method,
			durationMs: duration
		});
	}

	recentDurations.push(duration);
	requestCount++;

	if (requestCount % FLUSH_INTERVAL === 0) {
		const sorted = [...recentDurations].sort((a, b) => a - b);
		const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
		const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

		const summary = {
			p50,
			p95,
			count: requestCount,
			lastUpdated: new Date().toISOString()
		};

		try {
			await c.env.KV.put('perf:api:summary', JSON.stringify(summary), {
				expirationTtl: 86400
			});
		} catch {
			/* best-effort */
		}

		recentDurations = [];
	}
});

/** Read the current performance summary from KV. */
export async function getPerformanceSummary(
	kv: KVNamespace
): Promise<{ p50: number; p95: number; count: number; lastUpdated: string } | null> {
	const raw = await kv.get('perf:api:summary');
	return raw ? JSON.parse(raw) : null;
}
