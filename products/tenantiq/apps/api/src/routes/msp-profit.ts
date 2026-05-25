/**
 * MSP Profit Dashboard — shows how TenantIQ generates ROI per tenant.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSkuCost } from '../lib/constants';

export const mspProfitRoutes = new Hono<AppEnv>();
mspProfitRoutes.use('*', authMiddleware);

/** Per-tenant plan cost estimate (USD/mo). */
const PLAN_COST_PER_TENANT = 49;

interface TenantProfitRow {
	id: string;
	display_name: string;
	domain: string;
	status: string;
}

interface TenantProfit {
	name: string;
	domain: string;
	cost: number;
	savings: number;
	margin: number;
	roi: number;
}

/** GET /overview — MSP-level profit metrics across all tenants */
mspProfitRoutes.get('/overview', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ tenants: [], totals: {}, period: '30d' });

	const db = c.env.DB;

	const tenantsResult = await db
		.prepare(
			'SELECT id, display_name, domain, status FROM tenants WHERE organization_id = ?',
		)
		.bind(orgId)
		.all()
		.catch(() => ({ results: [] }));

	const rows = tenantsResult.results as TenantProfitRow[];
	const tenants: TenantProfit[] = await Promise.all(
		rows.map((t) => computeTenantProfit(db, c.env, t)),
	);

	tenants.sort((a, b) => b.roi - a.roi);

	const totalCost = tenants.reduce((s, t) => s + t.cost, 0);
	const totalSavings = tenants.reduce((s, t) => s + t.savings, 0);
	const totalMargin = totalSavings - totalCost;
	const avgRoi = totalCost > 0 ? Math.round((totalSavings / totalCost) * 100) : 0;

	return c.json({
		tenants,
		totals: { totalCost, totalSavings, totalMargin, avgRoi },
		period: '30d',
	});
});

async function computeTenantProfit(
	db: D1Database,
	env: any,
	t: TenantProfitRow,
): Promise<TenantProfit> {
	// Try KV cache first for savings
	let savings = 0;
	const kvKey = `savings:${t.id}`;
	const cached = await env.KV.get(kvKey).catch(() => null);

	if (cached) {
		savings = Number(cached);
	} else {
		savings = await computeSavingsFromLicenses(db, t.id);
	}

	const cost = PLAN_COST_PER_TENANT;
	const margin = savings - cost;
	const roi = cost > 0 ? Math.round((savings / cost) * 100) : 0;

	return {
		name: t.display_name,
		domain: t.domain ?? '',
		cost,
		savings: Math.round(savings),
		margin: Math.round(margin),
		roi,
	};
}

async function computeSavingsFromLicenses(
	db: D1Database,
	tenantId: string,
): Promise<number> {
	const licenseRows = await db
		.prepare(
			'SELECT sku_part_number, consumed_units, enabled_units FROM licenses_cache WHERE tenant_id = ?',
		)
		.bind(tenantId)
		.all()
		.catch(() => ({ results: [] }));

	let waste = 0;
	for (const r of licenseRows.results as any[]) {
		const consumed = Number(r.consumed_units ?? 0);
		const enabled = Number(r.enabled_units ?? 0);
		const costPerUnit = getSkuCost(r.sku_part_number);
		if (enabled > consumed) {
			waste += (enabled - consumed) * costPerUnit;
		}
	}
	return waste;
}

export default mspProfitRoutes;
