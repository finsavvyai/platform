/**
 * Snapshot Schedule API Routes
 * Set per-tenant snapshot frequency (daily/weekly/none).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';

export interface SnapshotScheduleConfig {
	frequency: 'daily' | 'weekly' | 'none';
	enabled: boolean;
	cronHour: number;
	updatedBy: string;
	updatedAt: string;
}

const scheduleSchema = z.object({
	frequency: z.enum(['daily', 'weekly', 'none']),
});

export const snapshotScheduleRoutes = new Hono<AppEnv>();
snapshotScheduleRoutes.use('*', authMiddleware);

// GET /api/config-snapshots/schedule — Get current schedule
snapshotScheduleRoutes.get('/schedule', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const raw = await c.env.KV.get(`snapshot-schedule:${tenantId}`, 'json');
	if (!raw) {
		return c.json({
			schedule: { frequency: 'none', enabled: false, cronHour: 2, updatedBy: '', updatedAt: '' },
		});
	}
	return c.json({ schedule: raw as SnapshotScheduleConfig });
});

// POST /api/config-snapshots/schedule — Set per-tenant frequency
snapshotScheduleRoutes.post('/schedule', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json().catch(() => ({}));
	const parsed = scheduleSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

	const user = c.get('user');
	const config: SnapshotScheduleConfig = {
		frequency: parsed.data.frequency,
		enabled: parsed.data.frequency !== 'none',
		cronHour: 2,
		updatedBy: user.email,
		updatedAt: new Date().toISOString(),
	};

	await c.env.KV.put(`snapshot-schedule:${tenantId}`, JSON.stringify(config));
	return c.json({ success: true, schedule: config });
});
