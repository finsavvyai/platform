import { compareTenants, type TenantSnapshot } from '@tenantiq/ai/tools/tenant-comparison';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const tenantComparison = new Hono<AppEnv>();

tenantComparison.use('*', authMiddleware);
tenantComparison.use('*', standardRateLimit);

/**
 * POST /api/tenant-comparison/compare
 * Compare multiple tenants (MSP portfolio view)
 */
tenantComparison.post('/compare', async (c) => {
	try {
		const body = await c.req.json<{ tenants: TenantSnapshot[] }>();

		if (!body.tenants || body.tenants.length < 2) {
			return c.json({ error: 'Bad Request', message: 'At least 2 tenants required for comparison' }, 400);
		}

		const result = compareTenants(body.tenants);

		return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Tenant comparison failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/tenant-comparison/preview
 * Preview comparison — returns empty until multiple tenants connected
 */
tenantComparison.get('/preview', async (c) => {
	try {
		const tenants: TenantSnapshot[] = [];
		const result = compareTenants(tenants);
		return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Tenant comparison failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default tenantComparison;
