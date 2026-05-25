/**
 * Nightly Backup Cron
 *
 * Runs at 2 AM UTC to back up all active tenants to R2.
 * Compares snapshots for drift detection and creates alerts
 * when configuration changes are detected.
 */

import type { Env } from '../app/types';
import { createTenantBackup, cleanupOldBackups } from '../lib/backup';
import type { TenantBackupData, BackupMetadata } from '../lib/backup';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { trackSyncJob } from '../lib/sync-job-tracker';

const RETENTION_DAYS = 30;

/** Run nightly backup for all active tenants */
export async function runNightlyBackup(env: Env): Promise<void> {
	console.log('[NightlyBackup] Starting nightly backup run');

	const db = getDb(env);
	const tenants = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.status, 'active'));

	let backedUp = 0;
	let driftAlerts = 0;
	let errors = 0;

	for (const tenant of tenants) {
		try {
			await trackSyncJob(env.DB, {
				type: 'nightly_backup',
				tenantId: tenant.id,
				orgId: tenant.id,
			}, async () => {
				const result = await backupTenant(env, { id: tenant.id, displayName: tenant.name, azureTenantId: tenant.azureTenantId });
				backedUp++;
				if (result.driftDetected) driftAlerts++;
				return { itemsProcessed: 1, itemsFailed: 0 };
			});
		} catch (err) {
			errors++;
			console.error(`[NightlyBackup] Failed for tenant ${tenant.name}:`, err);
		}
	}

	// Cleanup old backups across all tenants
	for (const tenant of tenants) {
		try {
			await cleanupOldBackups(env.R2, env.KV, tenant.id, RETENTION_DAYS);
		} catch (err) {
			console.error(`[NightlyBackup] Cleanup failed for ${tenant.id}:`, err);
		}
	}

	console.log(
		`[NightlyBackup] Complete: ${backedUp} tenants backed up, ${driftAlerts} drift alerts, ${errors} errors`
	);
}

interface BackupResult {
	metadata: BackupMetadata;
	driftDetected: boolean;
}

/** Back up a single tenant and check for drift */
async function backupTenant(env: Env, tenant: { id: string; displayName: string; azureTenantId?: string | null }): Promise<BackupResult> {
	const db = getDb(env);

	// Gather tenant data from DB tables
	const [users, alertRows] = await Promise.all([
		db.select().from(schema.platformUsers).where(eq(schema.platformUsers.organizationId, tenant.id)),
		db.select().from(schema.alerts).where(eq(schema.alerts.tenantId, tenant.id)),
	]);
	const alerts = alertRows;

	const backupData: TenantBackupData = {
		metadata: {
			tenantId: tenant.id,
			azureTenantId: tenant.azureTenantId ?? '',
			displayName: tenant.displayName ?? 'Unknown',
			domain: '',
			backupDate: new Date().toISOString(),
		},
		users: users.map((u) => ({
			id: u.id,
			userPrincipalName: u.email ?? '',
			displayName: u.name ?? '',
			mail: u.email ?? undefined,
			jobTitle: undefined,
			department: undefined,
			accountEnabled: u.status === 'active',
			assignedLicenses: [],
		})),
		licenses: [],
		alerts: alerts.map((a) => ({
			id: a.id,
			severity: a.severity ?? 'medium',
			title: a.title ?? '',
			status: a.status ?? 'active',
			createdDateTime: a.createdAt ?? '',
		})),
	};

	const metadata = await createTenantBackup(env.R2, env.KV, backupData);

	// Store latest backup pointer in KV
	await env.KV.put(`backup:${tenant.id}:latest`, JSON.stringify({
		backupId: metadata.backupId,
		timestamp: metadata.timestamp,
		size: metadata.size,
	}));

	// Check for drift against previous backup
	const driftDetected = await checkDrift(env, tenant.id, backupData);

	if (driftDetected) {
		await createDriftAlert(env, tenant.id);
	}

	return { metadata, driftDetected };
}

/** Compare current backup data with previous snapshot for drift */
async function checkDrift(env: Env, tenantId: string, current: TenantBackupData): Promise<boolean> {
	const previousSnapshotRaw = await env.KV.get(`backup-snapshot:${tenantId}`);

	// Store current snapshot for next comparison
	const snapshot = {
		userCount: current.users.length,
		licenseCount: current.licenses.length,
		alertCount: current.alerts?.length ?? 0,
	};
	await env.KV.put(`backup-snapshot:${tenantId}`, JSON.stringify(snapshot));

	if (!previousSnapshotRaw) return false;

	const previous = JSON.parse(previousSnapshotRaw) as typeof snapshot;
	const userDelta = Math.abs(current.users.length - previous.userCount);
	const threshold = Math.max(5, Math.floor(previous.userCount * 0.1));

	return userDelta > threshold;
}

/** Create a drift detection alert */
async function createDriftAlert(env: Env, tenantId: string): Promise<void> {
	const db = getDb(env);
	await db.insert(schema.alerts).values({
		id: crypto.randomUUID(),
		tenantId,
		severity: 'medium',
		type: 'drift',
		title: 'Configuration drift detected during nightly backup',
		description: 'Significant changes detected compared to previous backup snapshot.',
		source: 'intelligence_engine',
		status: 'active',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	});
}
