import { and, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb, schema } from '../lib/db';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import type { AppEnv } from '../app/types';

/**
 * Alert Analytics Routes
 *
 * Endpoints for alert trend analysis, distribution metrics,
 * and recurring alert detection.
 */

const alertAnalytics = new Hono<AppEnv>();

alertAnalytics.use('*', authMiddleware);
alertAnalytics.use('*', standardRateLimit);

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

function getPeriodStart(period: string): string {
	const days = PERIOD_DAYS[period] ?? 30;
	const start = new Date();
	start.setDate(start.getDate() - days);
	return start.toISOString();
}

function countBySeverity(alertList: { severity: string }[]) {
	const counts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const a of alertList) {
		if (a.severity in counts) counts[a.severity as keyof typeof counts]++;
	}
	return counts;
}

function groupByDay(alertList: { createdAt: string; severity: string }[]) {
	const groups: Record<string, { severity: string }[]> = {};
	for (const a of alertList) {
		const day = a.createdAt.slice(0, 10);
		if (!groups[day]) groups[day] = [];
		groups[day].push(a);
	}
	return Object.entries(groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, items]) => ({
			date,
			total: items.length,
			...countBySeverity(items),
		}));
}

function calculateMttr(alertList: { createdAt: string; resolvedAt: string | null }[]): number {
	const resolved = alertList.filter((a) => a.resolvedAt);
	if (resolved.length === 0) return 0;
	const totalMs = resolved.reduce((sum, a) => {
		return sum + (new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime());
	}, 0);
	return Math.round(totalMs / resolved.length / 3600000);
}

/** GET /api/alert-analytics/trends */
alertAnalytics.get('/trends', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const period = c.req.query('period') || '30d';
	const db = getDb(c.env);

	if (!PERIOD_DAYS[period]) {
		return c.json({ error: 'Bad Request', message: 'Invalid period. Use 7d, 30d, or 90d' }, 400);
	}

	const periodStart = getPeriodStart(period);
	const alertList = await db
		.select({
			severity: schema.alerts.severity,
			createdAt: schema.alerts.createdAt,
			resolvedAt: schema.alerts.resolvedAt,
			status: schema.alerts.status,
		})
		.from(schema.alerts)
		.where(and(eq(schema.alerts.tenantId, tenantId), gte(schema.alerts.createdAt, periodStart)));

	const dataPoints = groupByDay(alertList);
	const mttr = calculateMttr(alertList);
	const resolved = alertList.filter((a) => a.status === 'resolved').length;
	const resolutionRate = alertList.length > 0 ? +(resolved / alertList.length).toFixed(2) : 0;

	return c.json({ dataPoints, mttr, resolutionRate, totalAlerts: alertList.length });
});

/** GET /api/alert-analytics/distribution */
alertAnalytics.get('/distribution', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	const alertList = await db
		.select({
			type: schema.alerts.type,
			severity: schema.alerts.severity,
			source: schema.alerts.source,
		})
		.from(schema.alerts)
		.where(eq(schema.alerts.tenantId, tenantId));

	const typeMap: Record<string, number> = {};
	const severityMap: Record<string, number> = {};
	const sourceMap: Record<string, number> = {};

	for (const a of alertList) {
		typeMap[a.type] = (typeMap[a.type] || 0) + 1;
		severityMap[a.severity] = (severityMap[a.severity] || 0) + 1;
		sourceMap[a.source] = (sourceMap[a.source] || 0) + 1;
	}

	const topCategories = Object.entries(typeMap)
		.map(([category, count]) => ({ category, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	return c.json({
		byType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
		bySeverity: Object.entries(severityMap).map(([severity, count]) => ({ severity, count })),
		topCategories,
	});
});

/** GET /api/alert-analytics/recurring */
alertAnalytics.get('/recurring', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);
	const sevenDaysAgo = getPeriodStart('7d');

	const alertList = await db
		.select({
			type: schema.alerts.type,
			resourceId: schema.alerts.resourceId,
			createdAt: schema.alerts.createdAt,
		})
		.from(schema.alerts)
		.where(and(eq(schema.alerts.tenantId, tenantId), gte(schema.alerts.createdAt, sevenDaysAgo)));

	const grouped: Record<string, { count: number; firstSeen: string; lastSeen: string }> = {};

	for (const a of alertList) {
		const key = `${a.type}::${a.resourceId ?? 'unknown'}`;
		if (!grouped[key]) {
			grouped[key] = { count: 0, firstSeen: a.createdAt, lastSeen: a.createdAt };
		}
		grouped[key].count++;
		if (a.createdAt < grouped[key].firstSeen) grouped[key].firstSeen = a.createdAt;
		if (a.createdAt > grouped[key].lastSeen) grouped[key].lastSeen = a.createdAt;
	}

	const recurring = Object.entries(grouped)
		.filter(([, v]) => v.count > 1)
		.map(([key, v]) => {
			const [alertType, resourceId] = key.split('::');
			return { alertType, resourceId, count: v.count, firstSeen: v.firstSeen, lastSeen: v.lastSeen };
		})
		.sort((a, b) => b.count - a.count);

	return c.json({ recurring });
});

export { alertAnalytics as alertAnalyticsRoutes };
export default alertAnalytics;
