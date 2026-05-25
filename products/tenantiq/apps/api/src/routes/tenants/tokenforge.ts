/**
 * TokenForge config routes — setup, status, and toggle.
 * Device binding + event routes are in tokenforge-bindings.ts.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { genId, logTfEvent, setupSchema } from './tokenforge-helpers';
import { tokenforgeBindingRoutes } from './tokenforge-bindings';

export const tokenforgeRoutes = new Hono<AppEnv>();

// Mount binding sub-routes
tokenforgeRoutes.route('/', tokenforgeBindingRoutes);

// GET /:id/tokenforge/status — current config + stats
tokenforgeRoutes.get('/:id/tokenforge/status', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;

	const config = await db
		.prepare('SELECT * FROM tokenforge_config WHERE tenant_id = ?')
		.bind(tenantId)
		.first()
		.catch(() => null);

	if (!config) {
		return c.json({
			enabled: false,
			configured: false,
			enforceMode: 'monitor',
			stats: { totalBindings: 0, activeBindings: 0, revokedBindings: 0, recentEvents: 0 },
		});
	}

	const [bindingStats, eventCount] = await Promise.all([
		db.prepare(
			`SELECT
				COUNT(*) as total,
				SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
				SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
			 FROM tokenforge_device_bindings WHERE tenant_id = ?`,
		).bind(tenantId).first().catch(() => ({ total: 0, active: 0, revoked: 0 })),
		db.prepare(
			'SELECT COUNT(*) as cnt FROM tokenforge_events WHERE tenant_id = ? AND created_at > ?',
		).bind(tenantId, Date.now() - 7 * 86_400_000).first().catch(() => ({ cnt: 0 })),
	]);

	return c.json({
		enabled: config.enabled === 1,
		configured: true,
		enforceMode: config.enforce_mode,
		maxDevicesPerUser: config.max_devices_per_user,
		bindingTtlDays: config.binding_ttl_days,
		autoRevokeOnRisk: config.auto_revoke_on_risk === 1,
		stats: {
			totalBindings: (bindingStats as any)?.total ?? 0,
			activeBindings: (bindingStats as any)?.active ?? 0,
			revokedBindings: (bindingStats as any)?.revoked ?? 0,
			recentEvents: (eventCount as any)?.cnt ?? 0,
		},
	});
});

// POST /:id/tokenforge/setup — configure or update TokenForge
tokenforgeRoutes.post('/:id/tokenforge/setup', async (c) => {
	const tenantId = c.req.param('id');
	const user = c.get('user');
	const db = c.env.DB;

	const body = await c.req.json().catch(() => ({}));
	const parsed = setupSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid configuration', details: parsed.error.errors }, 400);
	}

	const { enforceMode, maxDevicesPerUser, bindingTtlDays, autoRevokeOnRisk } = parsed.data;
	const now = Date.now();

	const existing = await db
		.prepare('SELECT id FROM tokenforge_config WHERE tenant_id = ?')
		.bind(tenantId)
		.first()
		.catch(() => null);

	if (existing) {
		await db.prepare(
			`UPDATE tokenforge_config
			 SET enabled = 1, enforce_mode = ?, max_devices_per_user = ?,
			     binding_ttl_days = ?, auto_revoke_on_risk = ?, updated_at = ?
			 WHERE tenant_id = ?`,
		).bind(enforceMode, maxDevicesPerUser, bindingTtlDays, autoRevokeOnRisk ? 1 : 0, now, tenantId).run();
	} else {
		await db.prepare(
			`INSERT INTO tokenforge_config
			 (id, org_id, tenant_id, enabled, enforce_mode, max_devices_per_user, binding_ttl_days, auto_revoke_on_risk, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
		).bind(genId(), user.orgId, tenantId, enforceMode, maxDevicesPerUser, bindingTtlDays, autoRevokeOnRisk ? 1 : 0, now, now).run();
	}

	await logTfEvent(db, user.orgId, tenantId, 'config_updated', user.sub, undefined, { enforceMode, maxDevicesPerUser });
	return c.json({ success: true, enabled: true, enforceMode }, 201);
});

// POST /:id/tokenforge/toggle — enable / disable
tokenforgeRoutes.post('/:id/tokenforge/toggle', async (c) => {
	const tenantId = c.req.param('id');
	const user = c.get('user');
	const db = c.env.DB;

	const body = await c.req.json().catch(() => ({}));
	const enabled = body.enabled === true ? 1 : 0;

	const existing = await db
		.prepare('SELECT id FROM tokenforge_config WHERE tenant_id = ?')
		.bind(tenantId)
		.first();

	if (!existing) {
		return c.json({ error: 'TokenForge not configured. Call setup first.' }, 400);
	}

	await db.prepare('UPDATE tokenforge_config SET enabled = ?, updated_at = ? WHERE tenant_id = ?')
		.bind(enabled, Date.now(), tenantId)
		.run();

	await logTfEvent(db, user.orgId, tenantId, enabled ? 'enabled' : 'disabled', user.sub);
	return c.json({ success: true, enabled: enabled === 1 });
});
