/**
 * MSP-wide backup overview — every tenant the caller's org owns, with
 * health rollup. Powers /msp/backups dashboard so partners can spot
 * silent failures across the customer book in one view.
 *
 * Health rules:
 *   ok      — last backup < 36h, schedule enabled, no recent failures
 *   warning — last backup 36h–7d OR schedule disabled OR 1 recent failure
 *   error   — last backup > 7d OR no backup ever OR ≥2 recent failures
 *   off     — schedule disabled and no manual backups in 30d
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import type { BackupSchedule } from '../tenants/backup-schedule';
import { defaultSchedule } from '../tenants/backup-schedule';

export const mspBackupRoutes = new Hono<AppEnv>();
mspBackupRoutes.use('*', authMiddleware);

type Health = 'ok' | 'warning' | 'error' | 'off';

interface TenantBackupRow {
	tenantId: string;
	displayName: string;
	domain: string | null;
	status: string;
	lastBackupAt: string | null;
	lastBackupSizeBytes: number;
	last30dRunCount: number;
	last30dFailCount: number;
	scheduleEnabled: boolean;
	scheduleFrequency: BackupSchedule['frequency'];
	scheduleNextRun: string | null;
	health: Health;
	healthReason: string;
}

interface MspBackupSummary {
	totalTenants: number;
	ok: number;
	warning: number;
	error: number;
	off: number;
	totalSizeBytes: number;
	totalBackupsLast30d: number;
	totalFailuresLast30d: number;
}

mspBackupRoutes.get('/', async (c) => {
	const user = c.get('user');
	if (!user?.orgId) return c.json({ error: 'No organization context' }, 400);

	const db = getDb(c.env);
	const tenants = await c.env.DB.prepare(
		'SELECT id, display_name, domain, status FROM tenants WHERE org_id = ?',
	).bind(user.orgId).all<{ id: string; display_name: string; domain: string | null; status: string }>()
		.catch(() => ({ results: [] as Array<{ id: string; display_name: string; domain: string | null; status: string }> }));

	const rows: TenantBackupRow[] = [];
	const since = Date.now() - 30 * 86400_000;

	for (const t of tenants.results ?? []) {
		const [latestKv, schedule, jobs] = await Promise.all([
			c.env.KV.get(`backup:${t.id}:latest`, 'json') as Promise<{ backupId: string; timestamp: string; size: number } | null>,
			c.env.KV.get(`backup:schedule:${t.id}`, 'json') as Promise<BackupSchedule | null>,
			db.select().from(schema.backupJobs)
				.where(and(eq(schema.backupJobs.orgId, user.orgId), eq(schema.backupJobs.tenantId, t.id)))
				.orderBy(desc(schema.backupJobs.createdAt))
				.limit(50),
		]);

		const recent = jobs.filter((j) => (j.createdAt ?? 0) >= since);
		const failures = recent.filter((j) => j.status === 'failed').length;
		const completed = recent.filter((j) => j.status === 'completed');

		const lastBackupAt = latestKv?.timestamp
			?? (completed[0]?.completedAt ? new Date(completed[0].completedAt).toISOString() : null);
		const sched = schedule ?? defaultSchedule();
		const { health, reason } = classifyHealth(lastBackupAt, sched.enabled, failures, recent.length);

		rows.push({
			tenantId: t.id,
			displayName: t.display_name,
			domain: t.domain,
			status: t.status,
			lastBackupAt,
			lastBackupSizeBytes: latestKv?.size ?? completed[0]?.sizeBytes ?? 0,
			last30dRunCount: recent.length,
			last30dFailCount: failures,
			scheduleEnabled: sched.enabled,
			scheduleFrequency: sched.frequency,
			scheduleNextRun: sched.nextRun,
			health,
			healthReason: reason,
		});
	}

	const summary: MspBackupSummary = {
		totalTenants: rows.length,
		ok: rows.filter((r) => r.health === 'ok').length,
		warning: rows.filter((r) => r.health === 'warning').length,
		error: rows.filter((r) => r.health === 'error').length,
		off: rows.filter((r) => r.health === 'off').length,
		totalSizeBytes: rows.reduce((s, r) => s + r.lastBackupSizeBytes, 0),
		totalBackupsLast30d: rows.reduce((s, r) => s + r.last30dRunCount, 0),
		totalFailuresLast30d: rows.reduce((s, r) => s + r.last30dFailCount, 0),
	};

	rows.sort((a, b) => healthRank(a.health) - healthRank(b.health));

	return c.json({ summary, tenants: rows, generatedAt: new Date().toISOString() });
});

function classifyHealth(
	lastBackupAt: string | null,
	scheduleEnabled: boolean,
	failures: number,
	recentRuns: number,
): { health: Health; reason: string } {
	if (!lastBackupAt && !scheduleEnabled && recentRuns === 0) {
		return { health: 'off', reason: 'Never backed up; schedule disabled' };
	}
	if (!lastBackupAt) {
		return { health: 'error', reason: 'No completed backup on record' };
	}
	const ageMs = Date.now() - Date.parse(lastBackupAt);
	const ageHours = ageMs / 3600_000;
	if (ageHours > 7 * 24) return { health: 'error', reason: `Last backup ${Math.round(ageHours / 24)}d ago` };
	if (failures >= 2) return { health: 'error', reason: `${failures} failures in last 30d` };
	if (ageHours > 36) return { health: 'warning', reason: `Last backup ${Math.round(ageHours)}h ago` };
	if (!scheduleEnabled) return { health: 'warning', reason: 'Schedule disabled — manual only' };
	if (failures === 1) return { health: 'warning', reason: '1 failure in last 30d' };
	return { health: 'ok', reason: 'Healthy' };
}

function healthRank(h: Health): number {
	if (h === 'error') return 0;
	if (h === 'warning') return 1;
	if (h === 'off') return 2;
	return 3;
}
