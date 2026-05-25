import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware } from '../../middleware/admin-auth';

/**
 * Admin Metrics Routes
 *
 * GET /metrics          — performance metrics (latency, errors, active users)
 * GET /metrics/summary  — aggregated summary for dashboards
 */

const adminMetrics = new Hono<AppEnv>();

adminMetrics.use('*', authMiddleware);
adminMetrics.use('*', platformAdminMiddleware);

adminMetrics.get('/metrics', async (c) => {
	const db = c.env.DB;
	const metricType = c.req.query('type');
	const hours = parseInt(c.req.query('hours') ?? '24', 10);
	const since = Math.floor(Date.now() / 1000) - hours * 3600;

	try {
		let query = `SELECT * FROM platform_metrics WHERE recorded_at > ?`;
		const binds: (string | number)[] = [since];

		if (metricType) {
			query += ' AND metric_type = ?';
			binds.push(metricType);
		}

		query += ' ORDER BY recorded_at DESC LIMIT 500';

		const result = await db.prepare(query).bind(...binds).all();

		return c.json({
			metrics: (result.results ?? []).map((row: Record<string, unknown>) => ({
				...row,
				metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
			})),
			since,
			hours,
		});
	} catch (err) {
		console.error('Admin metrics error:', err);
		return c.json({ error: 'Failed to load metrics' }, 500);
	}
});

adminMetrics.get('/metrics/summary', async (c) => {
	const db = c.env.DB;
	const now = Math.floor(Date.now() / 1000);
	const last24h = now - 86400;
	const lastHour = now - 3600;

	try {
		const [latencyRes, errorRes, syncDurationRes, activeUsersRes] = await Promise.all([
			db.prepare(
				`SELECT AVG(value) as avg_val, MAX(value) as max_val, MIN(value) as min_val
				 FROM platform_metrics
				 WHERE metric_type = 'api_latency' AND recorded_at > ?`
			).bind(lastHour).first<{ avg_val: number; max_val: number; min_val: number }>(),
			db.prepare(
				`SELECT AVG(value) as avg_val, COUNT(*) as count
				 FROM platform_metrics
				 WHERE metric_type = 'error_rate' AND recorded_at > ?`
			).bind(last24h).first<{ avg_val: number; count: number }>(),
			db.prepare(
				`SELECT AVG(value) as avg_val, MAX(value) as max_val
				 FROM platform_metrics
				 WHERE metric_type = 'sync_duration' AND recorded_at > ?`
			).bind(last24h).first<{ avg_val: number; max_val: number }>(),
			db.prepare(
				`SELECT value FROM platform_metrics
				 WHERE metric_type = 'active_users'
				 ORDER BY recorded_at DESC LIMIT 1`
			).first<{ value: number }>(),
		]);

		return c.json({
			apiLatency: {
				avgMs: Math.round(latencyRes?.avg_val ?? 0),
				maxMs: Math.round(latencyRes?.max_val ?? 0),
				minMs: Math.round(latencyRes?.min_val ?? 0),
			},
			errorRate: {
				avg: Math.round((errorRes?.avg_val ?? 0) * 100) / 100,
				samples: errorRes?.count ?? 0,
			},
			syncDuration: {
				avgSec: Math.round(syncDurationRes?.avg_val ?? 0),
				maxSec: Math.round(syncDurationRes?.max_val ?? 0),
			},
			activeUsers: activeUsersRes?.value ?? 0,
		});
	} catch (err) {
		console.error('Admin metrics summary error:', err);
		return c.json({ error: 'Failed to load metrics summary' }, 500);
	}
});

export default adminMetrics;
