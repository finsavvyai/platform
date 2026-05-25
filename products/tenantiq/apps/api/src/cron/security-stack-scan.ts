/**
 * Security Stack Cron — periodic scan of all active tenants for configuration drift.
 * Uses raw D1 queries and GraphClient.fetch() for consistency with route patterns.
 */
import { createGraphClient } from '../lib/graph-client';
import type { ClientEnv } from '../lib/graph-client';
import {
	captureSecuritySnapshot,
	detectSecurityDrifts,
	type SecurityStackSnapshot,
} from '../lib/security-stack-monitor';
import { assertOrgId } from '../lib/org-scope-assert';

interface CronEnv {
	DB: D1Database;
	KV: KVNamespace;
	AZURE_CLIENT_ID?: string;
	AZURE_CLIENT_SECRET?: string;
}

export async function scanSecurityStack(env: CronEnv): Promise<void> {
	const db = env.DB;

	const tenantsResult = await db
		.prepare("SELECT id, azure_tenant_id, organization_id FROM tenants WHERE status = 'active'")
		.all();

	const activeTenants = tenantsResult.results ?? [];

	for (const tenant of activeTenants) {
		assertOrgId(tenant.organization_id as string | null, 'SecurityStackScan');
		try {
			const graph = createGraphClient(env as ClientEnv, tenant.azure_tenant_id as string);
			const currentSnapshot = await captureSecuritySnapshot(graph, tenant.id as string);

			// Get baseline
			const baseline = await db
				.prepare('SELECT * FROM config_snapshots WHERE tenant_id = ? AND baseline = 1 ORDER BY created_at DESC LIMIT 1')
				.bind(tenant.id)
				.first();

			const previousSnapshot: SecurityStackSnapshot | null = baseline?.snapshot_data
				? JSON.parse(baseline.snapshot_data as string)
				: null;
			const drifts = detectSecurityDrifts(currentSnapshot, previousSnapshot);

			// Store snapshot
			const snapshotId = crypto.randomUUID();
			await db
				.prepare(
					'INSERT INTO config_snapshots (id, tenant_id, label, snapshot_type, category_count, object_count, error_count, baseline, snapshot_data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(snapshotId, tenant.id, 'Auto-capture', 'auto', 5, 0, 0, 0, JSON.stringify(currentSnapshot), 'system', new Date().toISOString())
				.run();

			// Store drifts and alerts
			for (const drift of drifts) {
				await db
					.prepare(
						'INSERT INTO config_drifts (id, tenant_id, snapshot_id, baseline_id, category, path, old_value, new_value, severity, acknowledged, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(
						crypto.randomUUID(), tenant.id, snapshotId, baseline?.id ?? '',
						drift.product, drift.field,
						JSON.stringify(drift.previousValue), JSON.stringify(drift.currentValue),
						drift.severity, 0, new Date().toISOString()
					)
					.run();

				// Create security alert for critical/high drifts
				if (drift.severity === 'critical' || drift.severity === 'high') {
					await db
						.prepare(
							'INSERT INTO security_alerts (id, tenant_id, alert_type, severity, title, description, affected_users, potential_savings, status, metadata, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
						)
						.bind(
							crypto.randomUUID(), tenant.id, 'security_risk', drift.severity,
							`${drift.product}: ${drift.field} changed`, drift.recommendation,
							0, 0, 'active',
							JSON.stringify({ drift: { product: drift.product, field: drift.field } }),
							Date.now()
						)
						.run();
				}
			}
		} catch (error) {
			console.error(`Failed to scan security stack for tenant ${tenant.id}:`, error);
		}
	}
}

export async function triggerSecurityStackScan(env: CronEnv, tenantId: string): Promise<void> {
	const db = env.DB;
	const tenant = await db.prepare('SELECT id, azure_tenant_id FROM tenants WHERE id = ?').bind(tenantId).first();
	if (!tenant) throw new Error('Tenant not found');

	const graph = createGraphClient(env as ClientEnv, tenant.azure_tenant_id as string);
	const currentSnapshot = await captureSecuritySnapshot(graph, tenantId);

	const baseline = await db
		.prepare('SELECT * FROM config_snapshots WHERE tenant_id = ? AND baseline = 1 ORDER BY created_at DESC LIMIT 1')
		.bind(tenantId)
		.first();

	const previousSnapshot: SecurityStackSnapshot | null = baseline?.snapshot_data
		? JSON.parse(baseline.snapshot_data as string)
		: null;
	const drifts = detectSecurityDrifts(currentSnapshot, previousSnapshot);

	const snapshotId = crypto.randomUUID();
	await db
		.prepare(
			'INSERT INTO config_snapshots (id, tenant_id, label, snapshot_type, category_count, object_count, error_count, baseline, snapshot_data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(snapshotId, tenantId, 'Manual scan', 'manual', 5, 0, 0, 0, JSON.stringify(currentSnapshot), 'user', new Date().toISOString())
		.run();

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
}
