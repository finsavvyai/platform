import { analyzeCostOptimization } from '@tenantiq/ai/tools/cost-optimizer';
import { getLicensesByTenant, getUsersByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { getDb } from '../../lib/db';
import { buildLicenseUsageData } from './build-license-usage';

const analyze = new Hono<AppEnv>();

/**
 * GET /api/cost-optimization
 * Analyze license costs and get AI-powered savings recommendations
 */
analyze.get('/', async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const licenses = await getLicensesByTenant(db as any, tenantId);
		const users = await getUsersByTenant(db as any, tenantId);
		const licenseUsageData = buildLicenseUsageData(licenses, users);

		const inactivityThreshold = parseInt(c.req.query('inactivityThreshold') || '60');
		const result = analyzeCostOptimization(licenseUsageData, {
			warning: 30,
			critical: inactivityThreshold,
			severe: 90,
		});

		return c.json({
			success: true,
			data: result,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Cost optimization analysis failed:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

export default analyze;
