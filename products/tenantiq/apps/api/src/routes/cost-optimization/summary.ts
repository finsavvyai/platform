import { getLicensesByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { getDb } from '../../lib/db';

const summary = new Hono<AppEnv>();

/**
 * GET /api/cost-optimization/summary
 * Get quick cost summary without detailed analysis
 */
summary.get('/', async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const licenses = await getLicensesByTenant(db as any, tenantId);

		let totalMonthlyCost = 0;
		let unassignedLicenses = 0;
		let unassignedCost = 0;

		for (const license of licenses) {
			const cost = parseFloat(license.costPerUnit?.toString() || '0');
			totalMonthlyCost += license.assigned * cost;

			const unassigned = license.total - license.assigned;
			if (unassigned > 0) {
				unassignedLicenses += unassigned;
				unassignedCost += unassigned * cost;
			}
		}

		const totalAssigned = licenses.reduce((sum, l) => sum + l.assigned, 0);
		const totalCapacity = licenses.reduce((sum, l) => sum + l.total, 0);

		return c.json({
			success: true,
			data: {
				totalMonthlyCost,
				totalAnnualCost: totalMonthlyCost * 12,
				unassignedLicenses,
				unassignedMonthlyCost: unassignedCost,
				unassignedAnnualCost: unassignedCost * 12,
				utilizationRate: licenses.length > 0
					? ((totalAssigned / totalCapacity) * 100).toFixed(1)
					: 0,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Cost summary failed:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

export default summary;
