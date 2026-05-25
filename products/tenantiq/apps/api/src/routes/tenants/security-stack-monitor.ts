/**
 * Security Stack Monitor routes — drift detection, scanning, baseline management.
 * Uses raw D1 queries consistent with other tenant routes.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { createGraphClient } from '../../lib/graph-client';
import {
	captureSecuritySnapshot,
	detectSecurityDrifts,
	type SecurityStackSnapshot,
} from '../../lib/security-stack-monitor';

export const securityStackMonitorRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/security/stack/monitor
securityStackMonitorRoutes.get('/:id/security/stack/monitor', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;

	const snapshot = await db
		.prepare('SELECT * FROM config_snapshots WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
		.bind(tenantId)
		.first();

	if (!snapshot) {
		return c.json({ lastScan: null, drifts: [], snapshot: null }, 200);
	}

	const driftsResult = await db
		.prepare(
			`SELECT * FROM config_drifts WHERE tenant_id = ? AND snapshot_id = ? ORDER BY detected_at DESC`
		)
		.bind(tenantId, snapshot.id)
		.all()
		.catch(() => ({ results: [] }));

	const drifts = (driftsResult.results ?? []).map((d: any) => ({
		id: d.id,
		product: d.category,
		field: d.path,
		previousValue: d.old_value ? JSON.parse(d.old_value as string) : null,
		currentValue: d.new_value ? JSON.parse(d.new_value as string) : null,
		severity: d.severity,
		acknowledged: d.acknowledged === 1,
		detectedAt: d.detected_at,
	}));

	return c.json({ lastScan: snapshot.created_at, drifts, snapshot });
});

// POST /api/tenants/:id/security/stack/monitor/scan
securityStackMonitorRoutes.post('/:id/security/stack/monitor/scan', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;

	const tenant = await db
		.prepare('SELECT id, azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId)
		.first();
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	try {
		const graph = createGraphClient(c.env, tenant.azure_tenant_id as string);
		const currentSnapshot = await captureSecuritySnapshot(graph, tenantId);

		// Get baseline
		const baseline = await db
			.prepare('SELECT * FROM config_snapshots WHERE tenant_id = ? AND baseline = 1 ORDER BY created_at DESC LIMIT 1')
			.bind(tenantId)
			.first();

		const previousSnapshot = baseline?.snapshot_data
			? JSON.parse(baseline.snapshot_data as string)
			: null;
		const drifts = detectSecurityDrifts(currentSnapshot, previousSnapshot);

		// Store snapshot
		const snapshotId = crypto.randomUUID();
		await db
			.prepare(
				'INSERT INTO config_snapshots (id, tenant_id, label, snapshot_type, category_count, object_count, error_count, baseline, snapshot_data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
			)
			.bind(snapshotId, tenantId, 'Manual scan', 'manual', 5, 0, 0, 0, JSON.stringify(currentSnapshot), 'user', new Date().toISOString())
			.run();

		// Store drifts
		for (const drift of drifts) {
			await db
				.prepare(
					'INSERT INTO config_drifts (id, tenant_id, snapshot_id, baseline_id, category, path, old_value, new_value, severity, acknowledged, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(
					crypto.randomUUID(), tenantId, snapshotId, baseline?.id ?? '',
					drift.product, drift.field,
					JSON.stringify(drift.previousValue), JSON.stringify(drift.currentValue),
					drift.severity, 0, new Date().toISOString()
				)
				.run();
		}

		return c.json({ success: true, message: 'Scan completed', driftsFound: drifts.length, scannedAt: new Date().toISOString() }, 202);
	} catch (error) {
		return c.json({ error: 'Scan failed', message: (error as Error).message }, 500);
	}
});

// POST /api/tenants/:id/security/stack/monitor/baseline
securityStackMonitorRoutes.post('/:id/security/stack/monitor/baseline', async (c) => {
	const tenantId = c.req.param('id');
	const db = c.env.DB;

	const latest = await db
		.prepare('SELECT * FROM config_snapshots WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
		.bind(tenantId)
		.first();

	if (!latest) return c.json({ error: 'No snapshots found to set as baseline' }, 404);

	// Clear previous baseline
	await db
		.prepare('UPDATE config_snapshots SET baseline = 0 WHERE tenant_id = ? AND baseline = 1')
		.bind(tenantId)
		.run();

	// Set new baseline
	await db
		.prepare('UPDATE config_snapshots SET baseline = 1 WHERE id = ?')
		.bind(latest.id)
		.run();

	// Clear drifts for new baseline
	await db
		.prepare('DELETE FROM config_drifts WHERE tenant_id = ?')
		.bind(tenantId)
		.run();

	return c.json({ success: true, baseline: latest, message: 'Baseline updated. All drifts cleared.' });
});

// PATCH /api/tenants/:id/security/stack/monitor/drifts/:driftId/acknowledge
securityStackMonitorRoutes.patch('/:id/security/stack/monitor/drifts/:driftId/acknowledge', async (c) => {
	const tenantId = c.req.param('id');
	const driftId = c.req.param('driftId');
	const db = c.env.DB;

	await db
		.prepare('UPDATE config_drifts SET acknowledged = 1 WHERE tenant_id = ? AND id = ?')
		.bind(tenantId, driftId)
		.run();

	return c.json({ success: true });
});
