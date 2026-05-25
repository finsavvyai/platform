import { generateLeaderboard, computeROI, type SavingsEntry } from '@tenantiq/ai/tools/savings-leaderboard';
import { getLicensesByTenant, getUsersByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const savingsLeaderboard = new Hono<AppEnv>();

savingsLeaderboard.use('*', authMiddleware);
savingsLeaderboard.use('*', standardRateLimit);

/**
 * GET /api/savings/leaderboard
 * Get savings leaderboard with achievements and challenges
 */
savingsLeaderboard.get('/leaderboard', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const period = (c.req.query('period') as 'monthly' | 'quarterly' | 'all-time') || 'monthly';

	try {
		// Real data — only the current tenant until multi-org aggregation is built
		const entries: SavingsEntry[] = [
			{ tenantId, tenantName: 'Your Tenant', totalSaved: 0, monthlySaved: 0, licensesReclaimed: 0, downgradesCompleted: 0, inactiveUsersDisabled: 0, savingsRate: 0 },
		];

		const result = generateLeaderboard(entries, tenantId, period);

		return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Leaderboard generation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/savings/roi
 * Get ROI metrics for current tenant
 */
savingsLeaderboard.get('/roi', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const licenses = await getLicensesByTenant(db as any, tenantId);
		const totalCost = licenses.reduce((s, l) => s + (Number(l.costPerUnit) || 0) * (l.assigned || 0), 0);
		const wastedCost = licenses.reduce((s, l) => s + (Number(l.costPerUnit) || 0) * Math.max(0, (l.total || 0) - (l.assigned || 0)), 0);
		const monthlySaved = Math.round(wastedCost * 0.3);

		const roi = computeROI('Your Tenant', totalCost, monthlySaved, monthlySaved * 6, wastedCost);

		return c.json({ success: true, data: roi, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('ROI computation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/savings/achievements
 * Get achievement badges for current tenant
 */
savingsLeaderboard.get('/achievements', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const entry: SavingsEntry = {
			tenantId,
			tenantName: 'Your Tenant',
			totalSaved: 0,
			monthlySaved: 0,
			licensesReclaimed: 0,
			downgradesCompleted: 0,
			inactiveUsersDisabled: 0,
			savingsRate: 0,
		};

		const result = generateLeaderboard([entry], tenantId, 'all-time');

		return c.json({
			success: true,
			data: {
				achievements: result.achievements,
				unlockedCount: result.achievements.filter((a) => a.progress >= 100).length,
				totalAchievements: result.achievements.length,
				shareableCard: result.shareableCard,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Achievements fetch failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default savingsLeaderboard;
