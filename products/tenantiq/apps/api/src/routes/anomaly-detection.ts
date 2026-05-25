import {
	detectLoginAnomalies,
	detectActivityAnomalies,
	generateAnomalyReport,
	type LoginEvent,
	type ActivityMetrics,
} from '@tenantiq/ai/tools/anomaly-detection';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const anomalyDetection = new Hono<AppEnv>();

anomalyDetection.use('*', authMiddleware);
anomalyDetection.use('*', standardRateLimit);

/**
 * POST /api/anomaly-detection/scan
 * Run anomaly detection on login events and activity metrics
 */
anomalyDetection.post('/scan', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const body = await c.req.json<{
			loginEvents?: LoginEvent[];
			activityMetrics?: ActivityMetrics;
			tenantName?: string;
		}>();

		const anomalies = [
			...(body.loginEvents ? detectLoginAnomalies(body.loginEvents) : []),
			...(body.activityMetrics ? detectActivityAnomalies(body.activityMetrics) : []),
		];

		const report = generateAnomalyReport(tenantId, body.tenantName || 'Tenant', anomalies);

		return c.json({ success: true, data: report, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Anomaly detection failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * POST /api/anomaly-detection/login-check
 * Check login events for anomalies only
 */
anomalyDetection.post('/login-check', tenantScopingMiddleware, async (c) => {
	try {
		const body = await c.req.json<{ events: LoginEvent[] }>();

		if (!body.events || body.events.length === 0) {
			return c.json({ error: 'Bad Request', message: 'No login events provided' }, 400);
		}

		const anomalies = detectLoginAnomalies(body.events);

		return c.json({
			success: true,
			data: {
				anomalies,
				totalEvents: body.events.length,
				anomalyCount: anomalies.length,
				criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Login anomaly check failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * POST /api/anomaly-detection/activity-check
 * Check activity metrics for anomalies only
 */
anomalyDetection.post('/activity-check', tenantScopingMiddleware, async (c) => {
	try {
		const body = await c.req.json<{ metrics: ActivityMetrics }>();

		if (!body.metrics) {
			return c.json({ error: 'Bad Request', message: 'No activity metrics provided' }, 400);
		}

		const anomalies = detectActivityAnomalies(body.metrics);

		return c.json({
			success: true,
			data: {
				anomalies,
				anomalyCount: anomalies.length,
				categories: anomalies.reduce((acc, a) => {
					acc[a.category] = (acc[a.category] || 0) + 1;
					return acc;
				}, {} as Record<string, number>),
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Activity anomaly check failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default anomalyDetection;
