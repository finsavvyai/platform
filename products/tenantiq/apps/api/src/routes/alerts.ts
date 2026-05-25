import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../lib/db';
import { authMiddleware, requireRole, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { bustCache } from '../middleware/cache';
import type { AppEnv } from '../app/types';
import { applyAlertPrioritization, shouldPrioritize } from './alerts-prioritization';

const alertUpdateSchema = z.object({
	status: z.enum(['acknowledged', 'resolved', 'dismissed']),
	notes: z.string().max(2000).optional(),
});

/**
 * Alert & Recommendation Routes
 *
 * Endpoints for managing alerts, viewing recommendations,
 * and tracking alert lifecycle.
 */

const alerts = new Hono<AppEnv>();

// Apply authentication and rate limiting to all routes
alerts.use('*', authMiddleware);
alerts.use('*', standardRateLimit);

/**
 * GET /alerts
 * Get all alerts for a tenant with optional filtering
 */
alerts.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const status = c.req.query('status');
	const severity = c.req.query('severity');
	const type = c.req.query('type');
	const prioritize = shouldPrioritize(c.req.query('prioritize'));
	const db = getDb(c.env);

	const conditions = [eq(schema.alerts.tenantId, tenantId)];

	if (status) conditions.push(eq(schema.alerts.status, status));
	if (severity) conditions.push(eq(schema.alerts.severity, severity));
	if (type) conditions.push(eq(schema.alerts.type, type));

	const alertList = await db
		.select()
		.from(schema.alerts)
		.where(and(...conditions))
		.orderBy(desc(schema.alerts.createdAt))
		.limit(100);

	const mappedAlerts = alertList.map((r) => ({
		...r,
		metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
	}));

	if (prioritize) {
		const prioritizedAlerts = applyAlertPrioritization(mappedAlerts);
		return c.json({ alerts: prioritizedAlerts, count: prioritizedAlerts.length, prioritized: true });
	}

	return c.json({ alerts: mappedAlerts, count: mappedAlerts.length });
});

/**
 * GET /alerts/:alertId
 * Get detailed information about a specific alert
 */
alerts.get('/:alertId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const alertId = c.req.param('alertId');
	if (!alertId) return c.json({ error: 'Missing alertId' }, 400);
	const db = getDb(c.env);

	const alert = await db
		.select()
		.from(schema.alerts)
		.where(and(eq(schema.alerts.id, alertId), eq(schema.alerts.tenantId, tenantId)))
		.limit(1);

	if (alert.length === 0) {
		return c.json({ error: 'Not Found', message: 'Alert not found' }, 404);
	}

	const history = await db
		.select()
		.from(schema.alertHistory)
		.where(eq(schema.alertHistory.alertId, alertId))
		.orderBy(desc(schema.alertHistory.performedAt));

	const alertWithMeta = {
		...alert[0],
		metadata: alert[0].metadata ? JSON.parse(alert[0].metadata as string) : undefined,
	};
	return c.json({ alert: alertWithMeta, history });
});

/**
 * PATCH /alerts/:alertId
 * Update alert status
 */
alerts.patch('/:alertId', requireRole('operator', 'admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.get('userId');
	const alertId = c.req.param('alertId');
	if (!alertId) return c.json({ error: 'Missing alertId' }, 400);
	const raw = await c.req.json().catch(() => ({}));
	const parsed = alertUpdateSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json({ error: 'Bad Request', message: 'Invalid request body', details: parsed.error.flatten() }, 400);
	}
	const { status, notes } = parsed.data;
	const db = getDb(c.env);

	const existing = await db
		.select()
		.from(schema.alerts)
		.where(and(eq(schema.alerts.id, alertId), eq(schema.alerts.tenantId, tenantId)))
		.limit(1);

	if (existing.length === 0) {
		return c.json({ error: 'Not Found', message: 'Alert not found' }, 404);
	}

	await db
		.update(schema.alerts)
		.set({ status, updatedAt: new Date().toISOString() })
		.where(eq(schema.alerts.id, alertId));

	await db.insert(schema.alertHistory).values({
		id: crypto.randomUUID(),
		alertId,
		action: status,
		performedBy: userId ?? 'system',
		performedAt: new Date().toISOString(),
		notes: notes || null,
	});

	// Bust dashboard cache so alert counts update on next load
	const bustPromise = bustCache(c.env.KV, 'dashboard', `/api/tenants/${tenantId}/dashboard`, tenantId);
	try { c.executionCtx.waitUntil(bustPromise); } catch { await bustPromise; }

	return c.json({ message: 'Alert updated successfully', alertId, status });
});

export { alerts as alertRoutes };
export default alerts;
