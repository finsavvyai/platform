/**
 * Backup Health Routes
 *
 * Provides backup health status for tenants including last backup time,
 * backup count, total size, and health classification.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { listTenantBackups } from '../lib/backup';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireRole, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

type HealthStatus = 'healthy' | 'warning' | 'critical';

interface BackupHealthResponse {
	lastBackupAt: string | null;
	backupCount: number;
	totalSizeBytes: number;
	healthStatus: HealthStatus;
	issues: string[];
}

const HEALTHY_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const WARNING_THRESHOLD_MS = 96 * 60 * 60 * 1000;

const backupHealth = new Hono<AppEnv>();

backupHealth.use('*', authMiddleware);
backupHealth.use('*', standardRateLimit);

/** GET /api/backup-health — backup health for current tenant */
backupHealth.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const health = await getTenantBackupHealth(c.env.R2, c.env.KV, tenantId);
	return c.json(health);
});

/** GET /api/backup-health/all — MSP view of all tenant backup health (admin only) */
backupHealth.get('/all', requireRole('admin', 'super_admin'), async (c) => {
	const db = getDb(c.env);
	const tenantId = c.get('tenantId');

	const tenants = await db
		.select({ id: schema.organizations.id, displayName: schema.organizations.name })
		.from(schema.organizations)
		.where(eq(schema.organizations.id, tenantId));

	const results: Array<{ tenantId: string; displayName: string | null } & BackupHealthResponse> = [];

	for (const tenant of tenants) {
		const health = await getTenantBackupHealth(c.env.R2, c.env.KV, tenant.id);
		results.push({ tenantId: tenant.id, displayName: tenant.displayName, ...health });
	}

	const summary = {
		total: results.length,
		healthy: results.filter((r) => r.healthStatus === 'healthy').length,
		warning: results.filter((r) => r.healthStatus === 'warning').length,
		critical: results.filter((r) => r.healthStatus === 'critical').length,
	};

	return c.json({ tenants: results, summary });
});

/** Compute backup health for a single tenant */
async function getTenantBackupHealth(
	r2: R2Bucket,
	kv: KVNamespace,
	tenantId: string
): Promise<BackupHealthResponse> {
	const issues: string[] = [];

	// Check latest backup pointer from KV (fast path)
	const latestRaw = await kv.get(`backup:${tenantId}:latest`);
	let lastBackupAt: string | null = null;

	if (latestRaw) {
		const latest = JSON.parse(latestRaw) as { timestamp: string };
		lastBackupAt = latest.timestamp;
	}

	// List all backups from R2
	const backups = await listTenantBackups(r2, tenantId);
	const backupCount = backups.length;
	const totalSizeBytes = backups.reduce((sum, b) => sum + b.size, 0);

	// Fall back to R2 listing if KV has no pointer
	if (!lastBackupAt && backups.length > 0) {
		const sorted = backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
		lastBackupAt = sorted[0].timestamp;
	}

	// Determine health status
	const healthStatus = classifyHealth(lastBackupAt, issues);

	if (backupCount === 0) {
		issues.push('No backups found');
	}

	return { lastBackupAt, backupCount, totalSizeBytes, healthStatus, issues };
}

/** Classify backup health based on last backup age */
function classifyHealth(lastBackupAt: string | null, issues: string[]): HealthStatus {
	if (!lastBackupAt) return 'critical';

	const ageMs = Date.now() - new Date(lastBackupAt).getTime();

	if (ageMs > WARNING_THRESHOLD_MS) {
		issues.push('Last backup is older than 96 hours');
		return 'critical';
	}

	if (ageMs > HEALTHY_THRESHOLD_MS) {
		issues.push('Last backup is older than 48 hours');
		return 'warning';
	}

	return 'healthy';
}

export { backupHealth as backupHealthRoutes };
export default backupHealth;
