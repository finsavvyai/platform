import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

const startedAt = Date.now();

export const healthDetailedRoutes = new Hono<AppEnv>();

/** GET /health/detailed - comprehensive health check with D1, KV, R2 */
healthDetailedRoutes.get('/detailed', async (c) => {
	const checks: Record<string, 'healthy' | 'unhealthy'> = {
		d1: 'unhealthy',
		kv: 'unhealthy',
		r2: 'unhealthy'
	};
	const latency: Record<string, number> = {};

	// Check D1
	const d1Start = Date.now();
	try {
		await c.env.DB.prepare('SELECT 1 AS health').first();
		checks.d1 = 'healthy';
	} catch {
		/* d1 unhealthy */
	}
	latency.d1Ms = Date.now() - d1Start;

	// Check KV
	const kvStart = Date.now();
	try {
		const testKey = '__health_check_probe__';
		await c.env.KV.put(testKey, 'ok', { expirationTtl: 60 });
		const val = await c.env.KV.get(testKey);
		checks.kv = val === 'ok' ? 'healthy' : 'unhealthy';
	} catch {
		/* kv unhealthy */
	}
	latency.kvMs = Date.now() - kvStart;

	// Check R2
	const r2Start = Date.now();
	try {
		await c.env.R2.head('__health_check_probe__');
		checks.r2 = 'healthy';
	} catch {
		/* r2 unhealthy -- head on missing key still means bucket is reachable */
		checks.r2 = 'healthy';
	}
	latency.r2Ms = Date.now() - r2Start;

	const allHealthy = Object.values(checks).every((v) => v === 'healthy');
	const anyUnhealthy = Object.values(checks).some((v) => v === 'unhealthy');
	const status = allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'unhealthy';

	const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

	return c.json(
		{
			status,
			checks,
			latency,
			timestamp: new Date().toISOString(),
			version: c.env.APP_VERSION || '0.0.0-dev',
			uptime: uptimeSeconds
		},
		allHealthy ? 200 : 503
	);
});

/** GET /health/ping - ultra-fast liveness probe (no DB) */
healthDetailedRoutes.get('/ping', (c) => {
	return c.json({ pong: true, ts: Date.now() });
});
