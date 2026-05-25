/**
 * Backup Data Routes
 *
 * API endpoints for starting, listing, and restoring Exchange,
 * SharePoint, and Teams data backups.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import { startBackup, getJobStatus, listJobs, getStorageUsage } from '../lib/backup/orchestrator';
import type { BackupType, BackupStatus } from '../lib/backup/types';

const backupData = new Hono<AppEnv>();

backupData.use('*', authMiddleware);

const startSchema = z.object({
	type: z.enum(['exchange', 'sharepoint', 'teams']),
});

const listSchema = z.object({
	type: z.enum(['exchange', 'sharepoint', 'teams']).optional(),
	status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
	limit: z.coerce.number().min(1).max(100).optional(),
	offset: z.coerce.number().min(0).optional(),
});

const restoreSchema = z.object({
	jobId: z.string().min(1),
	items: z.array(z.string()).min(1),
	destination: z.enum(['original', 'alternate']),
});

/** POST /api/backups/start — start a new backup job */
backupData.post('/start', async (c) => {
	const body = await c.req.json();
	const parsed = startSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
	}

	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	const job = await startBackup(c.env, user.orgId, tenantId, parsed.data.type);
	return c.json({ job }, 201);
});

/** GET /api/backups/jobs — list backup jobs */
backupData.get('/jobs', async (c) => {
	const query = Object.fromEntries(new URL(c.req.url).searchParams);
	const parsed = listSchema.safeParse(query);
	if (!parsed.success) {
		return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400);
	}

	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	const result = await listJobs(c.env, user.orgId, tenantId, {
		type: parsed.data.type as BackupType | undefined,
		status: parsed.data.status as BackupStatus | undefined,
		limit: parsed.data.limit,
		offset: parsed.data.offset,
	});

	return c.json(result);
});

/** GET /api/backups/jobs/:id — get a single job status */
backupData.get('/jobs/:id', async (c) => {
	const jobId = c.req.param('id');
	const user = c.get('user');
	const job = await getJobStatus(c.env, jobId, user.orgId);

	if (!job) return c.json({ error: 'Job not found' }, 404);
	return c.json({ job });
});

/** POST /api/backups/restore — restore from a backup */
backupData.post('/restore', async (c) => {
	const body = await c.req.json();
	const parsed = restoreSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
	}

	const user = c.get('user');
	const job = await getJobStatus(c.env, parsed.data.jobId, user.orgId);

	if (!job) return c.json({ error: 'Backup job not found' }, 404);
	if (job.status !== 'completed') {
		return c.json({ error: 'Can only restore from completed backups' }, 400);
	}

	return c.json({
		restore: {
			jobId: job.id,
			itemsRequested: parsed.data.items.length,
			destination: parsed.data.destination,
			status: 'queued',
		},
	}, 202);
});

/** GET /api/backups/storage — storage usage stats */
backupData.get('/storage', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	const usage = await getStorageUsage(c.env, user.orgId, tenantId);
	return c.json({ usage });
});

export { backupData as backupDataRoutes };
export default backupData;
