import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

const adminStats = new Hono<AppEnv>();

adminStats.use('*', authMiddleware);
adminStats.use('*', platformAdminMiddleware);

adminStats.get('/stats', async (c) => {
	const db = c.env.DB;

	try {
		const [usersResult, orgsResult] = await Promise.all([
			db.prepare('SELECT id, email, COALESCE(display_name, name) as name, role, status, last_login_at, created_at FROM platform_users ORDER BY created_at DESC').all(),
			db.prepare('SELECT id, name, billing_plan, status, created_at FROM organizations ORDER BY created_at DESC').all(),
		]);

		const users = usersResult.results as Record<string, unknown>[];
		const orgs = orgsResult.results as Record<string, unknown>[];

		const activeUsers = users.filter(u => u.status === 'active');

		// Revenue from org billing plans
		const planPrices: Record<string, number> = { core: 79, professional: 199, security_suite: 399, enterprise: 0 };
		const monthlyRevenue = orgs.reduce((sum, o) => sum + (planPrices[String(o.billing_plan)] ?? 0), 0);
		const paidOrgs = orgs.filter(o => planPrices[String(o.billing_plan)]);

		const recentSignups = users.slice(0, 10).map(u => ({
			id: u.id, name: u.name ?? u.email, email: u.email, date: u.created_at,
		}));

		const recentLogins = users
			.filter(u => u.last_login_at)
			.sort((a, b) => Number(b.last_login_at ?? 0) - Number(a.last_login_at ?? 0))
			.slice(0, 10)
			.map(u => ({
				id: u.id, name: u.name ?? u.email, email: u.email, date: u.last_login_at,
			}));

		await logAdminAction(c, { action: 'view_stats', resourceType: 'platform' });

		return c.json({
			totalUsers: users.length,
			activeUsers: activeUsers.length,
			totalOrgs: orgs.length,
			activeSubscriptions: paidOrgs.length,
			monthlyRevenue,
			recentSignups,
			recentLogins,
		});
	} catch (error) {
		console.error('Admin stats error:', error);
		return c.json({ totalUsers: 0, activeUsers: 0, totalOrgs: 0, activeSubscriptions: 0, monthlyRevenue: 0, recentSignups: [], recentLogins: [] });
	}
});

export default adminStats;
