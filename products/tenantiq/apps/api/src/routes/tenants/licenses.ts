/**
 * Tenant consent and license routes.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { kvCache } from '../../middleware/cache';
import { getSkuCost, getSkuDisplayName } from '../../lib/constants';

export const licenseRoutes = new Hono<AppEnv>();

// POST /api/tenants/:id/consent/url — Get consent URL
licenseRoutes.post('/:id/consent/url', async (c) => {
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const url = `https://login.microsoftonline.com/common/adminconsent?client_id=${c.env.AZURE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
	return c.json({ url });
});

// GET /api/tenants/:id/consent/status — Check if consent was granted
licenseRoutes.get('/:id/consent/status', async (c) => {
	const id = c.req.param('id');
	const consented = await c.env.KV.get(`consent:${id}`);
	return c.json({ consented: Boolean(consented) });
});

// GET /api/tenants/:id/licenses (cached 120s)
licenseRoutes.get('/:id/licenses', kvCache({ ttl: 120, prefix: 'licenses' }), async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT * FROM licenses_cache WHERE tenant_id = ?')
		.bind(id)
		.all();

	const licenses = result.results.map((row: any) => ({
		id: row.id,
		skuId: row.sku_id,
		skuName: getSkuDisplayName(row.sku_part_number || row.sku_id),
		skuPartNumber: row.sku_part_number,
		total: Number(row.enabled_units ?? 0),
		assigned: Number(row.consumed_units ?? 0),
		available: Number(row.enabled_units ?? 0) - Number(row.consumed_units ?? 0),
		costPerUnit: getSkuCost(row.sku_part_number),
	}));

	const totalSpend = licenses.reduce((sum: number, l: any) => sum + l.assigned * l.costPerUnit, 0);
	const totalWaste = licenses.reduce((sum: number, l: any) => sum + l.available * l.costPerUnit, 0);

	return c.json({ licenses, totalSpend, totalWaste });
});

// GET /api/tenants/:id/licenses/waste
licenseRoutes.get('/:id/licenses/waste', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT * FROM licenses_cache WHERE tenant_id = ? AND enabled_units > consumed_units')
		.bind(id)
		.all();

	const wasteItems = result.results
		.map((row: any) => {
			const unassigned = Number(row.enabled_units ?? 0) - Number(row.consumed_units ?? 0);
			const costPerUnit = getSkuCost(row.sku_part_number);
			return {
				skuId: row.sku_id,
				skuPartNumber: row.sku_part_number,
				skuName: getSkuDisplayName(row.sku_part_number || row.sku_id),
				unassigned,
				monthlyCost: unassigned * costPerUnit,
			};
		})
		.filter((w: any) => w.monthlyCost > 0); // Hide free SKUs — $0 waste is not actionable
	const totalMonthlyWaste = wasteItems.reduce((sum: number, w: any) => sum + w.monthlyCost, 0);

	return c.json({ wasteItems, totalMonthlyWaste });
});
