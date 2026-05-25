import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

/**
 * Admin Overview Routes
 *
 * GET /overview — platform-wide stats (tenants, users, sync health)
 * GET /tenants — all tenants with health indicators
 */

const adminOverview = new Hono<AppEnv>();

adminOverview.use('*', authMiddleware);
adminOverview.use('*', platformAdminMiddleware);

adminOverview.get('/overview', async (c) => {
	const db = c.env.DB;
	try {
		const [tenantsRes, usersRes, orgsRes, syncRes, alertsRes] = await Promise.all([
			db.prepare('SELECT COUNT(*) as count FROM tenants').first<{ count: number }>(),
			db.prepare('SELECT COUNT(*) as count FROM platform_users').first<{ count: number }>(),
			db.prepare('SELECT COUNT(*) as count FROM organizations').first<{ count: number }>(),
			db.prepare(
				`SELECT status, COUNT(*) as count FROM sync_jobs
				 WHERE created_at > ? GROUP BY status`
			).bind(Math.floor(Date.now() / 1000) - 86400).all(),
			db.prepare(
				`SELECT COUNT(*) as count FROM security_alerts WHERE status = 'active'`
			).first<{ count: number }>(),
		]);

		const syncCounts: Record<string, number> = {};
		for (const row of (syncRes.results ?? []) as { status: string; count: number }[]) {
			syncCounts[row.status] = row.count;
		}

		return c.json({
			totalTenants: tenantsRes?.count ?? 0,
			totalUsers: usersRes?.count ?? 0,
			totalOrgs: orgsRes?.count ?? 0,
			activeAlerts: alertsRes?.count ?? 0,
			syncJobs24h: {
				pending: syncCounts.pending ?? 0,
				running: syncCounts.running ?? 0,
				completed: syncCounts.completed ?? 0,
				failed: syncCounts.failed ?? 0,
			},
		});
	} catch (err) {
		console.error('Admin overview error:', err);
		return c.json({ error: 'Failed to load overview' }, 500);
	}
});

adminOverview.get('/tenants', async (c) => {
	const db = c.env.DB;
	const page = parseInt(c.req.query('page') ?? '1', 10);
	const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);
	const offset = (page - 1) * limit;

	try {
		const [tenantsRes, countRes] = await Promise.all([
			db.prepare(
				`SELECT t.id, t.display_name, t.domain, t.status, t.last_sync_at, t.created_at,
						o.name as org_name, o.billing_plan,
						(SELECT COUNT(*) FROM users_cache WHERE tenant_id = t.id) as user_count,
						(SELECT COUNT(*) FROM security_alerts WHERE tenant_id = t.id AND status = 'active') as alert_count,
						(SELECT status FROM sync_jobs WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1) as last_sync_status
				 FROM tenants t
				 LEFT JOIN organizations o ON t.organization_id = o.id
				 ORDER BY t.created_at DESC
				 LIMIT ? OFFSET ?`
			).bind(limit, offset).all(),
			db.prepare('SELECT COUNT(*) as count FROM tenants').first<{ count: number }>(),
		]);

		await logAdminAction(c, { action: 'view_tenants', resourceType: 'tenant' });

		return c.json({
			tenants: tenantsRes.results ?? [],
			total: countRes?.count ?? 0,
			page,
			limit,
		});
	} catch (err) {
		console.error('Admin tenants error:', err);
		return c.json({ error: 'Failed to load tenants' }, 500);
	}
});

export default adminOverview;
