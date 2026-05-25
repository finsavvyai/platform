import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { strictRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../app/types';
import { remediationScheduleRoutes } from './remediation-schedule';
import { rollbackRoutes } from './remediation-rollback';

/** One-Click Remediation Routes — execute, track, and rollback remediation actions. */
const remediations = new Hono<AppEnv>();

remediations.use('*', authMiddleware);
remediations.use('*', strictRateLimit);

// Mount sub-routes before parameterized routes to avoid /:remediationId catching /scheduled
remediations.route('/', remediationScheduleRoutes);
remediations.route('/', rollbackRoutes);

/** GET /remediations — remediation history for a tenant */
remediations.get('/', tenantScopingMiddleware, async (c) => {
	const db = getDb(c.env);
	const remediationList = await db
		.select()
		.from(schema.remediations)
		.where(eq(schema.remediations.tenantId, c.get('tenantId')))
		.orderBy(desc(schema.remediations.initiatedAt))
		.limit(100);
	return c.json({ remediations: remediationList });
});

/** GET /remediations/:remediationId — single remediation with steps */
remediations.get('/:remediationId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const remediationId = c.req.param('remediationId');
	if (!remediationId) return c.json({ error: 'Missing remediationId' }, 400);
	const db = getDb(c.env);

	const remediation = await db
		.select()
		.from(schema.remediations)
		.where(and(eq(schema.remediations.id, remediationId), eq(schema.remediations.tenantId, tenantId)))
		.limit(1);

	if (remediation.length === 0) {
		return c.json({ error: 'Not Found', message: 'Remediation not found' }, 404);
	}

	const steps = await db
		.select()
		.from(schema.remediationSteps)
		.where(eq(schema.remediationSteps.remediationId, remediationId))
		.orderBy(schema.remediationSteps.stepNumber);

	return c.json({ remediation: remediation[0], steps });
});

/** POST /remediations/execute — execute or schedule a remediation */
remediations.post('/execute', requireRole('operator', 'admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.get('userId');
	const { alertId, actionType, actionParameters, scheduledAt } = await c.req.json();
	const db = getDb(c.env);

	if (!userId) {
		return c.json({ error: 'Unauthorized', message: 'User context is required' }, 401);
	}

	const alert = await db
		.select()
		.from(schema.alerts)
		.where(and(eq(schema.alerts.id, alertId), eq(schema.alerts.tenantId, tenantId)))
		.limit(1);

	if (alert.length === 0) {
		return c.json({ error: 'Not Found', message: 'Alert not found' }, 404);
	}
	if (!alert[0].canAutoRemediate) {
		return c.json({ error: 'Bad Request', message: 'This alert cannot be auto-remediated' }, 400);
	}

	// T2.2: license-tier upsell. Block remediation if the action requires a
	// premium SKU (Entra P1/P2) the tenant doesn't have, surfacing concrete
	// cost so the customer can decide to upgrade.
	const { checkRequiredSku, buildUpsell } = await import('../lib/remediation/task-license-requirements');
	let tenantSkus: Array<{ skuPartNumber: string }> = [];
	try {
		const skuRes = await c.env.DB
			.prepare('SELECT sku_part_number AS skuPartNumber FROM licenses_cache WHERE tenant_id = ?')
			.bind(tenantId)
			.all<{ skuPartNumber: string | null }>();
		tenantSkus = (skuRes.results ?? [])
			.map(r => ({ skuPartNumber: r.skuPartNumber ?? '' }))
			.filter(s => s.skuPartNumber);
	} catch {
		// no licenses cache (test env, fresh tenant) — assume no premium SKUs
	}
	const required = checkRequiredSku(actionType, tenantSkus);
	if (required) {
		const affected = (() => {
			try {
				const meta = alert[0].metadata ? JSON.parse(String(alert[0].metadata)) : {};
				return Array.isArray(meta.users) ? meta.users.length : 1;
			} catch { return 1; }
		})();
		const upsell = buildUpsell(required, affected);
		return c.json({
			error: 'Upgrade Required',
			code: 'LICENSE_UPGRADE_REQUIRED',
			message: `${required.display} required for this remediation. ${required.reason}`,
			upsell,
		}, 402);
	}

	const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
	const status = isScheduled ? 'scheduled' : 'pending';
	const remediationId = crypto.randomUUID();

	await db.insert(schema.remediations).values({
		id: remediationId,
		alertId,
		tenantId,
		actionType,
		status,
		scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null,
		initiatedBy: userId,
		initiatedAt: new Date().toISOString(),
		targetResourceId: alert[0].resourceId!,
		targetResourceType: alert[0].resourceType!,
		actionParameters: actionParameters ? JSON.stringify(actionParameters) : null,
		success: 0,
		canRollback: 1,
		rollbackData: null,
	});

	if (!isScheduled) {
		await c.env.REMEDIATION_QUEUE.send({
			tenantId,
			alertId,
			remediationId,
			actionId: actionType,
			affectedResources: alert[0].metadata
				? JSON.parse(String(alert[0].metadata)).affectedResources ?? []
				: [],
			executedBy: userId,
		});
	}

	return c.json({
		message: isScheduled ? 'Remediation scheduled' : 'Remediation queued for execution',
		remediationId,
		alertId,
		status,
		...(isScheduled ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
	});
});

export default remediations;
