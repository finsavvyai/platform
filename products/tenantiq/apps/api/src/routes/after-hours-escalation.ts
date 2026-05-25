/**
 * After-Hours Alert Escalation Routes
 *
 * POST /api/after-hours/evaluate — Evaluate if an event should be escalated
 * GET /api/after-hours/config — Get tenant business hours config
 * PUT /api/after-hours/config — Update tenant business hours config
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import {
	getAfterHoursContext,
	escalateSeverity,
	shouldEscalateRoute,
	type BusinessHoursConfig,
} from '../lib/after-hours-escalation';

export const afterHoursRoutes = new Hono<AppEnv>();
afterHoursRoutes.use('*', authMiddleware);

afterHoursRoutes.post('/evaluate', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{
		severity: string;
		timestamp?: string;
	}>();

	const configJson = await c.env.KV.get(`after-hours:${tenantId}:config`, 'json');
	const config = (configJson as BusinessHoursConfig) || undefined;

	const lastLoginStr = await c.env.KV.get(`after-hours:${tenantId}:last-business-login`);
	const lastLogin = lastLoginStr ? new Date(lastLoginStr) : null;

	const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
	const context = getAfterHoursContext(timestamp, config, lastLogin);
	const escalation = escalateSeverity(body.severity, context);
	const routing = shouldEscalateRoute(context);

	return c.json({
		context,
		escalation,
		routing,
		isEscalated: escalation !== null,
	});
});

afterHoursRoutes.get('/config', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const config = await c.env.KV.get(`after-hours:${tenantId}:config`, 'json');
	return c.json({
		config: config || {
			timezone: 'UTC',
			startHour: 8,
			endHour: 18,
			workDays: [1, 2, 3, 4, 5],
		},
	});
});

afterHoursRoutes.put('/config', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<BusinessHoursConfig>();

	if (body.startHour < 0 || body.startHour > 23 || body.endHour < 0 || body.endHour > 23) {
		return c.json({ error: 'Hours must be 0-23' }, 400);
	}
	if (!Array.isArray(body.workDays) || body.workDays.some((d) => d < 0 || d > 6)) {
		return c.json({ error: 'Work days must be array of 0-6' }, 400);
	}

	await c.env.KV.put(`after-hours:${tenantId}:config`, JSON.stringify(body));
	return c.json({ success: true, config: body });
});

afterHoursRoutes.post('/record-login', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const configJson = await c.env.KV.get(`after-hours:${tenantId}:config`, 'json');
	const config = (configJson as BusinessHoursConfig) || undefined;
	const now = new Date();
	const context = getAfterHoursContext(now, config);

	if (!context.isAfterHours) {
		await c.env.KV.put(`after-hours:${tenantId}:last-business-login`, now.toISOString());
	}

	return c.json({ recorded: true, isBusinessHours: !context.isAfterHours });
});
