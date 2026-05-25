import { generateUsageHeatmap, type UsageInput } from '@tenantiq/ai/tools/usage-heatmap';
import { getUsersByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const usageHeatmap = new Hono<AppEnv>();

usageHeatmap.use('*', authMiddleware);
usageHeatmap.use('*', standardRateLimit);

/**
 * GET /api/usage-heatmap
 * Generate usage heatmap and adoption scoring for current tenant
 */
usageHeatmap.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const users = await getUsersByTenant(db as any, tenantId);

		const input: UsageInput = {
			totalUsers: users.length,
			serviceAdoption: {},
		};

		const result = generateUsageHeatmap(tenantId, 'Tenant', input);

		return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Usage heatmap generation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * POST /api/usage-heatmap/custom
 * Generate heatmap with custom service adoption data
 */
usageHeatmap.post('/custom', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const body = await c.req.json<{ input: UsageInput; tenantName?: string; period?: string }>();

		if (!body.input || !body.input.totalUsers) {
			return c.json({ error: 'Bad Request', message: 'Usage input with totalUsers required' }, 400);
		}

		const result = generateUsageHeatmap(tenantId, body.tenantName || 'Tenant', body.input, body.period);

		return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Custom heatmap generation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/usage-heatmap/adoption-score
 * Get just the adoption score summary
 */
usageHeatmap.get('/adoption-score', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const users = await getUsersByTenant(db as any, tenantId);

		const input: UsageInput = { totalUsers: users.length, serviceAdoption: {} };
		const result = generateUsageHeatmap(tenantId, 'Tenant', input);

		return c.json({
			success: true,
			data: {
				adoptionScore: result.adoptionScore,
				insights: result.insights,
				shareableCard: result.shareableCard,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Adoption score failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default usageHeatmap;
