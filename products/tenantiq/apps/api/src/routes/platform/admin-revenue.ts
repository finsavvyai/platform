/**
 * Admin Revenue Analytics — MRR, churn, ARPU, plan distribution.
 * Platform admin only. Derives $ from tier since LS-aligned schema doesn't
 * store amount_cents per subscription.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { platformAdminMiddleware, logAdminAction } from '../../middleware/admin-auth';

const adminRevenue = new Hono<AppEnv>();
adminRevenue.use('*', authMiddleware);
adminRevenue.use('*', platformAdminMiddleware);

// Monthly list price per tier (USD cents). Annual billing is folded into the
// same monthly bucket for MRR purposes.
const TIER_CENTS: Record<string, number> = {
	core: 7900,
	professional: 19900,
	security_suite: 39900,
	enterprise: 0, // custom-priced — excluded from MRR until per-sub pricing is captured
	trial: 0,
	free: 0,
};

// GET /revenue — MRR, churn rate, ARPU, plan distribution
adminRevenue.get('/revenue', async (c) => {
	const db = c.env.DB;
	try {
		const [planRes, churnRes, recentRes] = await Promise.all([
			db.prepare(
				`SELECT tier, COUNT(*) as count
				 FROM subscriptions WHERE status IN ('active', 'on_trial')
				 GROUP BY tier ORDER BY count DESC`,
			).all<{ tier: string; count: number }>(),
			db.prepare(
				`SELECT COUNT(*) as count FROM subscriptions
				 WHERE status = 'cancelled' AND updated_at > ?`,
			).bind(new Date(Date.now() - 30 * 86400_000).toISOString()).first<{ count: number }>(),
			db.prepare(
				`SELECT id, organization_id, tier, status, created_at
				 FROM subscriptions ORDER BY created_at DESC LIMIT 10`,
			).all(),
		]);

		const planDistribution = (planRes.results ?? []).map((r) => ({
			plan: r.tier,
			count: Number(r.count),
		}));

		const activeSubs = planDistribution.reduce((s, p) => s + p.count, 0);
		const totalCents = planDistribution.reduce(
			(s, p) => s + (TIER_CENTS[p.plan] ?? 0) * p.count,
			0,
		);
		const mrr = totalCents / 100;
		const arpu = activeSubs > 0 ? mrr / activeSubs : 0;

		const churnedLast30d = churnRes?.count ?? 0;
		const totalAtStartOfPeriod = activeSubs + churnedLast30d;
		const churnRate = totalAtStartOfPeriod > 0
			? (churnedLast30d / totalAtStartOfPeriod) * 100
			: 0;

		await logAdminAction(c, { action: 'view_revenue', resourceType: 'revenue' });

		return c.json({
			mrr: Math.round(mrr * 100) / 100,
			arr: Math.round(mrr * 12 * 100) / 100,
			arpu: Math.round(arpu * 100) / 100,
			activeSubs,
			churnRate: Math.round(churnRate * 100) / 100,
			churnedLast30d,
			planDistribution,
			recentSubscriptions: recentRes.results ?? [],
		});
	} catch (err) {
		console.error('Revenue analytics error:', err);
		return c.json({ error: 'Failed to load revenue data' }, 500);
	}
});

export default adminRevenue;
