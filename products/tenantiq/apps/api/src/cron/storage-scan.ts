/**
 * Storage Scan Cron
 *
 * Weekly scan of OneDrive/SharePoint usage for all active tenants.
 * Stores results in storage_analytics and generates alerts when quotas are exceeded.
 */

import type { Env } from '../app/types';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { GraphClient } from '../lib/graph-client';
import { scanOneDriveUsage, scanSharePointUsage } from '../lib/storage/storage-scanner';
import { trackSyncJob } from '../lib/sync-job-tracker';

const QUOTA_THRESHOLDS = [
	{ pct: 95, severity: 'critical' as const },
	{ pct: 90, severity: 'high' as const },
	{ pct: 80, severity: 'medium' as const },
];

function pickThreshold(utilizationPct: number) {
	return QUOTA_THRESHOLDS.find((t) => utilizationPct >= t.pct) ?? null;
}

async function createQuotaAlert(
	db: D1Database,
	tenantId: string,
	resource: string,
	utilizationPct: number,
	severity: string,
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO alerts (id, tenant_id, severity, type, title, description, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
		)
		.bind(
			crypto.randomUUID(),
			tenantId,
			severity,
			'storage_quota',
			`Storage quota ${utilizationPct}% — ${resource}`,
			`${resource} is at ${utilizationPct}% capacity. Consider cleanup or quota expansion.`,
			'intelligence_engine',
			'active',
			new Date().toISOString(),
			new Date().toISOString(),
		)
		.run();
}

export async function runStorageScan(env: Env): Promise<void> {
	console.log('[StorageScan] Starting weekly storage scan');

	const db = getDb(env);
	const tenants = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.status, 'active'));

	let scanned = 0;
	let alerts = 0;

	for (const tenant of tenants) {
		try {
			await trackSyncJob(env.DB, {
				type: 'storage_scan',
				tenantId: tenant.id,
				orgId: tenant.id,
			}, async () => {
				if (!tenant.azureTenantId) throw new Error(`No Azure tenant for ${tenant.id}`);
				const graph = new GraphClient(env, tenant.azureTenantId);

				const [odUsers, spSites] = await Promise.all([
					scanOneDriveUsage(graph),
					scanSharePointUsage(graph),
				]);

				const odUsedGb = odUsers.reduce((s, u) => s + u.usedGB, 0);
				const odAllocGb = odUsers.reduce((s, u) => s + u.allocatedGB, 0);
				const spUsedGb = spSites.reduce((s, u) => s + u.usedGB, 0);
				const spAllocGb = spSites.reduce((s, u) => s + u.allocatedGB, 0);
				const now = Date.now();

				// Store OneDrive results
				await env.DB.prepare(
					'INSERT INTO storage_analytics (id, org_id, tenant_id, scan_type, data, total_used_gb, total_allocated_gb, top_consumers, scanned_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				).bind(
					crypto.randomUUID(), tenant.id, tenant.id, 'onedrive',
					JSON.stringify(odUsers.slice(0, 20)), odUsedGb, odAllocGb,
					JSON.stringify(odUsers.slice(0, 5).map((u) => ({ name: u.displayName, gb: u.usedGB }))),
					now, now,
				).run();

				// Store SharePoint results
				await env.DB.prepare(
					'INSERT INTO storage_analytics (id, org_id, tenant_id, scan_type, data, total_used_gb, total_allocated_gb, top_consumers, scanned_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				).bind(
					crypto.randomUUID(), tenant.id, tenant.id, 'sharepoint',
					JSON.stringify(spSites.slice(0, 20)), spUsedGb, spAllocGb,
					JSON.stringify(spSites.slice(0, 5).map((s) => ({ name: s.name, gb: s.usedGB }))),
					now, now,
				).run();

				// Check quota thresholds and create alerts
				let newAlerts = 0;
				for (const user of odUsers) {
					const threshold = pickThreshold(user.utilizationPct);
					if (threshold) {
						await createQuotaAlert(env.DB, tenant.id, `OneDrive: ${user.displayName}`, user.utilizationPct, threshold.severity);
						newAlerts++;
					}
				}
				for (const site of spSites) {
					const threshold = pickThreshold(site.utilizationPct);
					if (threshold) {
						await createQuotaAlert(env.DB, tenant.id, `SharePoint: ${site.name}`, site.utilizationPct, threshold.severity);
						newAlerts++;
					}
				}
				alerts += newAlerts;
				scanned++;

				console.log(`[StorageScan] ${tenant.name}: ${odUsers.length} OD users, ${spSites.length} SP sites, ${newAlerts} alerts`);
				return { itemsProcessed: odUsers.length + spSites.length, itemsFailed: 0 };
			});
		} catch (err) {
			console.error(`[StorageScan] Failed for ${tenant.name}:`, err);
		}
	}

	console.log(`[StorageScan] Complete: ${scanned} tenants, ${alerts} alerts`);
}
