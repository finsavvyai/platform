import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

/**
 * Admin Sync Job Routes
 *
 * GET  /sync-jobs     — list sync jobs with filtering
 * POST /sync-jobs/:id/retry — retry a failed sync job
 */

const adminSync = new Hono<AppEnv>();

adminSync.use('*', authMiddleware);
adminSync.use('*', platformAdminMiddleware);

adminSync.get('/sync-jobs', async (c) => {
	const db = c.env.DB;
	const status = c.req.query('status');
	const tenantId = c.req.query('tenantId');
	const page = parseInt(c.req.query('page') ?? '1', 10);
	const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
	const offset = (page - 1) * limit;

	try {
		let query = `SELECT sj.*, t.display_name as tenant_name
					  FROM sync_jobs sj
					  LEFT JOIN tenants t ON sj.tenant_id = t.id
					  WHERE 1=1`;
		const binds: (string | number)[] = [];

		if (status) {
			query += ' AND sj.status = ?';
			binds.push(status);
		}
		if (tenantId) {
			query += ' AND sj.tenant_id = ?';
			binds.push(tenantId);
		}

		const countQuery = query.replace(/SELECT sj\.\*, t\.display_name as tenant_name/, 'SELECT COUNT(*) as count');

		query += ' ORDER BY sj.created_at DESC LIMIT ? OFFSET ?';
		binds.push(limit, offset);

		const [jobsRes, countRes] = await Promise.all([
			db.prepare(query).bind(...binds).all(),
			db.prepare(countQuery).bind(...binds.slice(0, -2)).all(),
		]);

		return c.json({
			jobs: jobsRes.results ?? [],
			total: (countRes.results?.[0] as { count?: number })?.count ?? 0,
			page,
			limit,
		});
	} catch (err) {
		console.error('Admin sync-jobs error:', err);
		return c.json({ error: 'Failed to load sync jobs' }, 500);
	}
});

adminSync.post('/sync-jobs/:id/retry', async (c) => {
	const db = c.env.DB;
	const jobId = c.req.param('id');

	try {
		const job = await db
			.prepare('SELECT * FROM sync_jobs WHERE id = ?')
			.bind(jobId)
			.first<{ id: string; status: string; tenant_id: string; type: string; org_id: string }>();

		if (!job) {
			return c.json({ error: 'Sync job not found' }, 404);
		}

		if (job.status !== 'failed') {
			return c.json({ error: 'Only failed jobs can be retried' }, 400);
		}

		const newId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		await db
			.prepare(
				`INSERT INTO sync_jobs (id, org_id, tenant_id, type, status, created_at)
				 VALUES (?, ?, ?, ?, 'pending', ?)`
			)
			.bind(newId, job.org_id, job.tenant_id, job.type, now)
			.run();

		await logAdminAction(c, {
			action: 'retry_sync_job',
			resourceType: 'sync_job',
			resourceId: jobId,
			details: { newJobId: newId, tenantId: job.tenant_id },
		});

		return c.json({ success: true, newJobId: newId });
	} catch (err) {
		console.error('Admin retry sync error:', err);
		return c.json({ error: 'Failed to retry sync job' }, 500);
	}
});

export default adminSync;
