/**
 * Tenant backup routes: create, list, restore, cleanup, AI analysis.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { getDb } from '../../lib/db';
import { getTenantById } from '@tenantiq/db';
import {
	createTenantBackup,
	restoreTenantBackup,
	listTenantBackups,
	cleanupOldBackups,
	type TenantBackupData,
} from '../../lib/backup';

export const backupRoutes = new Hono<AppEnv>();

// POST /api/tenants/:id/backup/analyze — AI backup health analysis
backupRoutes.post('/:id/backup/analyze', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const backupStatus = await c.env.KV.get(`backup:${id}`, 'json') as {
		lastBackupTimestamp?: string; failedBackups?: number; backupSizeGB?: number;
		exchangeBackupEnabled?: boolean; sharepointBackupEnabled?: boolean; onedriveBackupEnabled?: boolean;
	} | null;

	const backupData = {
		totalItems: 0,
		lastBackupTimestamp: backupStatus?.lastBackupTimestamp,
		failedBackups: backupStatus?.failedBackups || 0,
		backupSizeGB: backupStatus?.backupSizeGB || 0,
		retentionDays: 30,
		encryptionEnabled: false,
		exchangeBackupEnabled: backupStatus?.exchangeBackupEnabled || false,
		sharepointBackupEnabled: backupStatus?.sharepointBackupEnabled || false,
		onedriveBackupEnabled: backupStatus?.onedriveBackupEnabled || false,
	};

	if (!c.env.AI_ENGINE) return c.json({ error: 'AI engine not configured' }, 503);

	try {
		const response = await c.env.AI_ENGINE.fetch('https://ai-engine/api/m365/backup-analyze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ backupData }),
		});
		const result = await response.json() as { analysis: unknown; source: string };
		return c.json(result);
	} catch (err) {
		console.error('AI backup analysis failed:', err);
		return c.json({ error: 'AI analysis failed' }, 500);
	}
});

// POST /api/tenants/:id/backup/create — Create encrypted M365 tenant backup
backupRoutes.post('/:id/backup/create', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	if (!c.env.R2) return c.json({ error: 'Backup storage (R2) not configured' }, 503);

	try {
		// Raw D1 queries — Drizzle schema uses Postgres column names that drift from D1.
		const [usersRes, licensesRes] = await Promise.all([
			c.env.DB.prepare(
				'SELECT id, user_principal_name, display_name, mail, job_title, department, account_enabled, last_sign_in_at, created_at FROM users_cache WHERE tenant_id = ? LIMIT 50000',
			).bind(id).all().catch(() => ({ results: [] as any[] })),
			c.env.DB.prepare(
				'SELECT sku_id, sku_part_number, consumed, total FROM licenses_cache WHERE tenant_id = ?',
			).bind(id).all().catch(() => ({ results: [] as any[] })),
		]);
		const users = usersRes.results as any[];
		const licenses = licensesRes.results as any[];

		const backupData: TenantBackupData = {
			metadata: {
				tenantId: id, azureTenantId: tenant.azureTenantId,
				displayName: tenant.displayName, domain: tenant.domain,
				backupDate: new Date().toISOString(),
			},
			users: users.map((u) => ({
				id: u.id,
				userPrincipalName: u.user_principal_name,
				displayName: u.display_name,
				mail: u.mail || undefined,
				jobTitle: u.job_title || undefined,
				department: u.department || undefined,
				accountEnabled: Boolean(u.account_enabled),
				createdDateTime: u.created_at ? new Date(Number(u.created_at) * 1000).toISOString() : undefined,
				signInActivity: u.last_sign_in_at
					? { lastSignInDateTime: new Date(Number(u.last_sign_in_at) * 1000).toISOString() }
					: undefined,
				assignedLicenses: [],
			})),
			licenses: licenses.map((l) => ({
				skuId: l.sku_id,
				skuPartNumber: l.sku_part_number,
				consumedUnits: Number(l.consumed ?? 0),
				prepaidUnits: { enabled: Number(l.total ?? 0), suspended: 0, warning: 0 },
			})),
			alerts: [],
		};

		const metadata = await createTenantBackup(c.env.R2, c.env.KV, backupData);
		return c.json({
			success: true, backup: metadata,
			message: `Backup created successfully. ${metadata.items.users} users and ${metadata.items.licenses} licenses backed up.`,
		}, 201);
	} catch (err) {
		console.error('Backup creation failed:', err);
		return c.json({ error: 'Backup failed' }, 500);
	}
});

// GET /api/tenants/:id/backups — List all backups for tenant
backupRoutes.get('/:id/backups', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	try {
		const backups = await listTenantBackups(c.env.R2, id);
		return c.json({ backups });
	} catch (err) {
		console.error('Failed to list backups:', err);
		return c.json({ error: 'Failed to list backups' }, 500);
	}
});

// POST /api/tenants/:id/backup/restore — Restore from backup
backupRoutes.post('/:id/backup/restore', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const body = await c.req.json();
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
	if (!body.backupId) return c.json({ error: 'backupId required' }, 400);

	try {
		const restoredData = await restoreTenantBackup(c.env.R2, c.env.KV, body.backupId, id);
		return c.json({
			success: true, metadata: restoredData.metadata,
			stats: { users: restoredData.users.length, licenses: restoredData.licenses.length, groups: restoredData.groups?.length || 0 },
			message: 'Backup restored successfully. Review the data before applying to production.',
			data: restoredData,
		});
	} catch (err) {
		console.error('Backup restore failed:', err);
		return c.json({ error: 'Restore failed' }, 500);
	}
});

// DELETE /api/tenants/:id/backups/cleanup — Clean up old backups
backupRoutes.delete('/:id/backups/cleanup', async (c) => {
	const id = c.req.param('id');
	const retentionDays = Number(c.req.query('retentionDays')) || 90;
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	try {
		const deleted = await cleanupOldBackups(c.env.R2, c.env.KV, id, retentionDays);
		return c.json({ success: true, deleted, message: `Cleaned up ${deleted} backup(s) older than ${retentionDays} days` });
	} catch (err) {
		console.error('Backup cleanup failed:', err);
		return c.json({ error: 'Cleanup failed' }, 500);
	}
});
