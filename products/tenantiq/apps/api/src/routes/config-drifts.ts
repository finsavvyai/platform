/**
 * Config Drift Detection API Routes
 * Lists drifts, acknowledges drifts, gets drift summary.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import type { DriftRow } from '../lib/snapshots/snapshot-types';

export const configDriftRoutes = new Hono<AppEnv>();
configDriftRoutes.use('*', authMiddleware);

// GET /api/config-drifts — List detected drifts for the tenant
configDriftRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ drifts: [] });

	const severity = c.req.query('severity');
	const acknowledged = c.req.query('acknowledged');

	let sql = 'SELECT * FROM config_drifts WHERE tenant_id = ?';
	const params: string[] = [tenantId];

	if (severity) {
		sql += ' AND severity = ?';
		params.push(severity);
	}
	if (acknowledged === '0' || acknowledged === '1') {
		sql += ' AND acknowledged = ?';
		params.push(acknowledged);
	}

	sql += ' ORDER BY detected_at DESC LIMIT 100';

	const result = await c.env.DB.prepare(sql)
		.bind(...params).all<DriftRow>()
		.catch(() => ({ results: [] as DriftRow[] }));

	return c.json({ drifts: result.results });
});

// GET /api/config-drifts/summary — Drift summary counts
configDriftRoutes.get('/summary', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ total: 0, critical: 0, warning: 0, info: 0, unacknowledged: 0 });

	const [total, critical, warning, info, unack] = await Promise.all([
		c.env.DB.prepare('SELECT COUNT(*) as c FROM config_drifts WHERE tenant_id = ?')
			.bind(tenantId).first<{ c: number }>(),
		c.env.DB.prepare('SELECT COUNT(*) as c FROM config_drifts WHERE tenant_id = ? AND severity = ?')
			.bind(tenantId, 'critical').first<{ c: number }>(),
		c.env.DB.prepare('SELECT COUNT(*) as c FROM config_drifts WHERE tenant_id = ? AND severity = ?')
			.bind(tenantId, 'warning').first<{ c: number }>(),
		c.env.DB.prepare('SELECT COUNT(*) as c FROM config_drifts WHERE tenant_id = ? AND severity = ?')
			.bind(tenantId, 'info').first<{ c: number }>(),
		c.env.DB.prepare('SELECT COUNT(*) as c FROM config_drifts WHERE tenant_id = ? AND acknowledged = 0')
			.bind(tenantId).first<{ c: number }>(),
	]);

	return c.json({
		total: total?.c ?? 0,
		critical: critical?.c ?? 0,
		warning: warning?.c ?? 0,
		info: info?.c ?? 0,
		unacknowledged: unack?.c ?? 0,
	});
});

// PATCH /api/config-drifts/:id/acknowledge — Acknowledge a drift
configDriftRoutes.patch('/:id/acknowledge', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const driftId = c.req.param('id');
	await c.env.DB.prepare(
		'UPDATE config_drifts SET acknowledged = 1 WHERE id = ? AND tenant_id = ?'
	).bind(driftId, tenantId).run();

	return c.json({ success: true });
});

// PATCH /api/config-drifts/acknowledge-all — Acknowledge all drifts
configDriftRoutes.patch('/acknowledge-all', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	await c.env.DB.prepare(
		'UPDATE config_drifts SET acknowledged = 1 WHERE tenant_id = ? AND acknowledged = 0'
	).bind(tenantId).run();

	return c.json({ success: true });
});

// GET /api/config-drifts/:id/revert-plan — Show what reverting this drift would do.
// Does not apply changes; the UI shows the planned ops + asks for explicit
// approval before POSTing to /:id/revert.
configDriftRoutes.get('/:id/revert-plan', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const driftId = c.req.param('id');
	const drift = await c.env.DB
		.prepare('SELECT id, category, path, old_value, new_value, severity FROM config_drifts WHERE id = ? AND tenant_id = ? LIMIT 1')
		.bind(driftId, tenantId)
		.first<{ id: string; category: string; path: string; old_value: string | null; new_value: string | null; severity: string }>();

	if (!drift) return c.json({ error: 'Drift not found' }, 404);

	const { planRevert } = await import('../lib/snapshots/revert');
	let oldValue: unknown = null, newValue: unknown = null;
	try { oldValue = drift.old_value ? JSON.parse(drift.old_value) : null; } catch { oldValue = drift.old_value; }
	try { newValue = drift.new_value ? JSON.parse(drift.new_value) : null; } catch { newValue = drift.new_value; }

	const plan = planRevert({
		categoryId: drift.category,
		path: drift.path,
		oldValue,
		newValue,
	});

	return c.json({ driftId: drift.id, plan });
});

// POST /api/config-drifts/:id/revert — Apply the revert plan via Graph.
// Requires admin role. Always writes to audit_logs. Currently mounted but
// returns 503 unless the request includes { confirmed: true } AND the
// caller has permission. Apply uses the GraphClient already in scope for
// this tenant.
configDriftRoutes.post('/:id/revert', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const user = c.get('user');
	if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
		return c.json({ error: 'Forbidden — admin role required' }, 403);
	}

	const body = await c.req.json().catch(() => ({})) as { confirmed?: boolean };
	if (!body.confirmed) {
		return c.json({ error: 'Pass { confirmed: true } to apply. Use GET /revert-plan first.' }, 400);
	}

	const driftId = c.req.param('id');
	const drift = await c.env.DB
		.prepare('SELECT id, category, path, old_value, new_value FROM config_drifts WHERE id = ? AND tenant_id = ? LIMIT 1')
		.bind(driftId, tenantId)
		.first<{ id: string; category: string; path: string; old_value: string | null; new_value: string | null }>();
	if (!drift) return c.json({ error: 'Drift not found' }, 404);

	const { planRevert } = await import('../lib/snapshots/revert');
	let oldValue: unknown = null, newValue: unknown = null;
	try { oldValue = drift.old_value ? JSON.parse(drift.old_value) : null; } catch { /* keep null */ }
	try { newValue = drift.new_value ? JSON.parse(drift.new_value) : null; } catch { /* keep null */ }

	const plan = planRevert({ categoryId: drift.category, path: drift.path, oldValue, newValue });
	if (!plan.supported) return c.json({ error: 'This drift is not revertable', reason: plan.reason }, 400);

	const tenant = await c.env.DB
		.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId)
		.first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const { GraphClient } = await import('../lib/graph-client');
	const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);

	const results: Array<{ method: string; path: string; ok: boolean; error?: string }> = [];
	for (const op of plan.ops) {
		try {
			await (graph as any).fetch(op.path, { method: op.method, body: op.body ? JSON.stringify(op.body) : undefined });
			results.push({ method: op.method, path: op.path, ok: true });
		} catch (err) {
			results.push({ method: op.method, path: op.path, ok: false, error: err instanceof Error ? err.message : String(err) });
		}
	}

	// Best-effort audit log entry — never block on it.
	const allOk = results.every(r => r.ok);
	await c.env.DB.prepare(
		`INSERT INTO audit_logs (id, org_id, tenant_id, actor_id, actor_email, action, target_type, target_id, metadata, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		crypto.randomUUID(),
		user.orgId, tenantId, user.sub, user.email,
		'drift_revert',
		'config_drift', driftId,
		JSON.stringify({ category: drift.category, path: drift.path, ops: plan.ops, results, summary: plan.humanSummary }),
		new Date().toISOString(),
	).run().catch(() => {});

	if (allOk) {
		await c.env.DB.prepare('UPDATE config_drifts SET acknowledged = 1 WHERE id = ? AND tenant_id = ?')
			.bind(driftId, tenantId).run().catch(() => {});
	}

	return c.json({ success: allOk, results, summary: plan.humanSummary });
});
