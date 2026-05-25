/**
 * MSP Multi-Tenant Dashboard — comprehensive cross-tenant overview.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { getSkuCost } from '../lib/constants';

export const mspRoutes = new Hono<AppEnv>();
mspRoutes.use('*', authMiddleware);

/** Compute a 0–100 health score from alerts, utilization, and sync freshness. */
function computeHealthScore(
	critical: number, high: number, medium: number,
	licenseUtilPct: number, lastSyncAt: string | null
): number {
	let score = 100;
	score -= critical * 15;
	score -= high * 8;
	score -= medium * 3;

	// Penalize low utilization (waste) or over-provisioning
	if (licenseUtilPct > 0 && licenseUtilPct < 50) score -= 10;
	else if (licenseUtilPct >= 50 && licenseUtilPct < 70) score -= 5;

	// Penalize stale sync
	if (lastSyncAt) {
		const hoursAgo = (Date.now() - new Date(lastSyncAt).getTime()) / 3_600_000;
		if (hoursAgo > 48) score -= 15;
		else if (hoursAgo > 24) score -= 8;
		else if (hoursAgo > 12) score -= 3;
	} else {
		score -= 20; // Never synced
	}

	return Math.max(0, Math.min(100, score));
}

function healthLevel(score: number): 'green' | 'yellow' | 'red' {
	if (score >= 75) return 'green';
	if (score >= 50) return 'yellow';
	return 'red';
}

// GET /overview — Full MSP comparison data
mspRoutes.get('/overview', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ tenants: [], summary: {} });

	const db = c.env.DB;

	const tenantsResult = await db.prepare(
		'SELECT id, display_name, domain, status, last_sync_at FROM tenants WHERE organization_id = ?'
	).bind(orgId).all().catch(() => ({ results: [] }));

	const rows = tenantsResult.results as Array<{
		id: string; display_name: string; domain: string;
		status: string; last_sync_at: string | null;
	}>;

	const tenants = await Promise.all(rows.map(t => buildTenantSummary(db, c.env, t)));
	tenants.sort((a, b) => a.healthScore - b.healthScore); // worst first

	const summary = buildSummary(tenants);
	return c.json({ tenants, summary });
});

interface TenantRow {
	id: string; display_name: string; domain: string;
	status: string; last_sync_at: string | null;
}

async function buildTenantSummary(db: D1Database, env: any, t: TenantRow) {
	const [userCount, licenseRows, alertRows] = await Promise.all([
		db.prepare(
			'SELECT COUNT(*) as total FROM users_cache WHERE tenant_id = ?'
		).bind(t.id).first().catch(() => null),
		db.prepare(
			'SELECT sku_part_number, consumed_units, enabled_units FROM licenses_cache WHERE tenant_id = ?'
		).bind(t.id).all().catch(() => ({ results: [] })),
		db.prepare(
			"SELECT severity, COUNT(*) as cnt FROM alerts WHERE tenant_id = ? AND status = 'active' GROUP BY severity"
		).bind(t.id).all().catch(() => ({ results: [] })),
	]);

	const totalUsers = Number((userCount as any)?.total ?? 0);
	const { consumed, enabled, spend, waste } = computeLicenseMetrics(licenseRows.results);
	const alerts = parseAlertCounts(alertRows.results);
	const licenseUtilPct = enabled > 0 ? Math.round((consumed / enabled) * 100) : 0;
	const healthScore = computeHealthScore(
		alerts.critical, alerts.high, alerts.medium, licenseUtilPct, t.last_sync_at
	);

	return {
		id: t.id,
		displayName: t.display_name,
		domain: t.domain ?? '',
		status: t.status,
		lastSyncAt: t.last_sync_at,
		userCount: totalUsers,
		licenseUtilization: licenseUtilPct,
		monthlySpend: Math.round(spend),
		monthlyWaste: Math.round(waste),
		alertCounts: alerts,
		healthScore,
		health: healthLevel(healthScore),
	};
}

function computeLicenseMetrics(rows: any[]) {
	let consumed = 0, enabled = 0, spend = 0, waste = 0;
	for (const r of rows) {
		const c = Number(r.consumed_units ?? 0);
		const e = Number(r.enabled_units ?? 0);
		const cost = getSkuCost(r.sku_part_number);
		consumed += c;
		enabled += e;
		spend += c * cost;
		if (e > c) waste += (e - c) * cost;
	}
	return { consumed, enabled, spend, waste };
}

function parseAlertCounts(rows: any[]) {
	const counts: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		const cnt = Number(r.cnt ?? 0);
		counts[r.severity] = cnt;
		total += cnt;
	}
	return {
		total,
		critical: counts['critical'] ?? 0,
		high: counts['high'] ?? 0,
		medium: counts['medium'] ?? 0,
		low: counts['low'] ?? 0,
	};
}

type TenantSummary = Awaited<ReturnType<typeof buildTenantSummary>>;

function buildSummary(tenants: TenantSummary[]) {
	return {
		totalTenants: tenants.length,
		totalUsers: tenants.reduce((s, t) => s + t.userCount, 0),
		totalSpend: tenants.reduce((s, t) => s + t.monthlySpend, 0),
		totalWaste: tenants.reduce((s, t) => s + t.monthlyWaste, 0),
		totalAlerts: tenants.reduce((s, t) => s + t.alertCounts.total, 0),
		totalCritical: tenants.reduce((s, t) => s + t.alertCounts.critical, 0),
	};
}
