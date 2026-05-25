import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

/**
 * Admin Audit Log Routes
 *
 * GET /audit-logs — filterable audit log of all admin actions
 */

const adminAudit = new Hono<AppEnv>();

adminAudit.use('*', authMiddleware);
adminAudit.use('*', platformAdminMiddleware);

adminAudit.get('/audit-logs', async (c) => {
	const db = c.env.DB;
	const action = c.req.query('action');
	const userId = c.req.query('userId');
	const resourceType = c.req.query('resourceType');
	const page = parseInt(c.req.query('page') ?? '1', 10);
	const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
	const offset = (page - 1) * limit;

	try {
		let query = `SELECT al.*, pu.email as user_email, pu.display_name as user_name
					  FROM audit_logs al
					  LEFT JOIN platform_users pu ON al.user_id = pu.id
					  WHERE 1=1`;
		const binds: (string | number)[] = [];

		if (action) {
			query += ' AND al.action = ?';
			binds.push(action);
		}
		if (userId) {
			query += ' AND al.user_id = ?';
			binds.push(userId);
		}
		if (resourceType) {
			query += ' AND al.resource_type = ?';
			binds.push(resourceType);
		}

		const countQuery = query.replace(
			/SELECT al\.\*, pu\.email as user_email, pu\.display_name as user_name/,
			'SELECT COUNT(*) as count'
		);

		query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
		binds.push(limit, offset);

		const [logsRes, countRes] = await Promise.all([
			db.prepare(query).bind(...binds).all(),
			db.prepare(countQuery).bind(...binds.slice(0, -2)).all(),
		]);

		const logs = (logsRes.results ?? []).map((row: Record<string, unknown>) => ({
			...row,
			details: row.details ? JSON.parse(String(row.details)) : null,
		}));

		return c.json({
			logs,
			total: (countRes.results?.[0] as { count?: number })?.count ?? 0,
			page,
			limit,
		});
	} catch (err) {
		console.error('Admin audit-logs error:', err);
		return c.json({ error: 'Failed to load audit logs' }, 500);
	}
});

adminAudit.get('/audit-logs/actions', async (c) => {
	const db = c.env.DB;
	try {
		const result = await db
			.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action')
			.all();
		return c.json({
			actions: (result.results ?? []).map((r: Record<string, unknown>) => r.action),
		});
	} catch (err) {
		console.error('Admin audit-logs actions error:', err);
		return c.json({ error: 'Failed to load action types' }, 500);
	}
});

export default adminAudit;
