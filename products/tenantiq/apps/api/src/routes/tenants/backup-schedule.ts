/**
 * Backup schedule per tenant. Stored in KV (`backup:schedule:<tenantId>`).
 * Read by web /backups settings panel and by the nightly-backup cron to
 * decide which tenants run on a given day.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { getDb } from '../../lib/db';
import { getTenantById } from '@tenantiq/db';

export const backupScheduleRoutes = new Hono<AppEnv>();

export interface BackupSchedule {
	enabled: boolean;
	frequency: 'daily' | 'weekly' | 'monthly';
	time: string; // HH:MM UTC
	dayOfWeek?: number; // 0..6 for weekly
	dayOfMonth?: number; // 1..28 for monthly
	retentionDays: number;
	lastRun: string | null;
	nextRun: string | null;
}

const SCHEDULE_TTL = 60 * 60 * 24 * 365;

backupScheduleRoutes.get('/:id/backup/schedule', async (c) => {
	const id = c.req.param('id');
	const stored = await c.env.KV.get(`backup:schedule:${id}`, 'json') as BackupSchedule | null;
	return c.json(stored ?? defaultSchedule());
});

backupScheduleRoutes.post('/:id/backup/schedule', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const body = await c.req.json().catch(() => ({})) as Partial<BackupSchedule>;
	const incoming: BackupSchedule = {
		enabled: body.enabled === true,
		frequency: body.frequency === 'weekly' || body.frequency === 'monthly' ? body.frequency : 'daily',
		time: typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time) ? body.time : '03:00',
		dayOfWeek: typeof body.dayOfWeek === 'number' ? Math.max(0, Math.min(6, body.dayOfWeek)) : undefined,
		dayOfMonth: typeof body.dayOfMonth === 'number' ? Math.max(1, Math.min(28, body.dayOfMonth)) : undefined,
		retentionDays: typeof body.retentionDays === 'number' ? Math.max(7, Math.min(3650, body.retentionDays)) : 90,
		lastRun: body.lastRun ?? null,
		nextRun: computeNextRun(body),
	};

	await c.env.KV.put(`backup:schedule:${id}`, JSON.stringify(incoming), { expirationTtl: SCHEDULE_TTL });
	return c.json(incoming);
});

export function defaultSchedule(): BackupSchedule {
	return { enabled: false, frequency: 'daily', time: '03:00', retentionDays: 90, lastRun: null, nextRun: null };
}

export function computeNextRun(s: Partial<BackupSchedule>): string | null {
	if (!s.enabled) return null;
	const [h, m] = (s.time ?? '03:00').split(':').map(Number);
	const next = new Date();
	next.setUTCHours(h || 3, m || 0, 0, 0);
	if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
	if (s.frequency === 'weekly' && typeof s.dayOfWeek === 'number') {
		while (next.getUTCDay() !== s.dayOfWeek) next.setUTCDate(next.getUTCDate() + 1);
	}
	if (s.frequency === 'monthly' && typeof s.dayOfMonth === 'number') {
		next.setUTCDate(s.dayOfMonth);
		if (next.getTime() <= Date.now()) next.setUTCMonth(next.getUTCMonth() + 1);
	}
	return next.toISOString();
}
