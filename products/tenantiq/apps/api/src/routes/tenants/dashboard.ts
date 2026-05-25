/**
 * Tenant dashboard route: aggregated metrics (cached 60s).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { kvCache } from '../../middleware/cache';
import { getSkuCost } from '../../lib/constants';
import { forbidden } from '../../lib/errors';
import { verifyTenantAccess } from './helpers';

export const dashboardRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/dashboard — Aggregated metrics (cached 60s)
dashboardRoutes.get('/:id/dashboard', kvCache({ ttl: 60, prefix: 'dashboard' }), async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const db = c.env.DB;

	const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
	const [alertResult, userStats, riskyUsersResult, licenseRows, recentAlertRows, tenantRow] = await Promise.all([
		db.prepare("SELECT severity, COUNT(*) as count FROM alerts WHERE tenant_id = ? AND status = 'active' GROUP BY severity").bind(id).all().catch(() => ({ results: [] })),
		db.prepare(`SELECT
			COUNT(*) as total,
			SUM(CASE WHEN account_enabled = 1 THEN 1 ELSE 0 END) as active,
			SUM(CASE WHEN account_enabled = 0 THEN 1 ELSE 0 END) as disabled,
			SUM(CASE WHEN account_enabled = 1 AND (last_sign_in_at IS NULL OR last_sign_in_at < ?) THEN 1 ELSE 0 END) as inactive
		FROM users_cache WHERE tenant_id = ?`).bind(ninetyDaysAgo, id).first().catch(() => null),
		db.prepare(`SELECT display_name, mail, user_principal_name, account_enabled, last_sign_in_at
			FROM users_cache WHERE tenant_id = ?
			ORDER BY CASE WHEN account_enabled = 0 THEN 0 WHEN last_sign_in_at IS NULL THEN 1 ELSE 2 END, last_sign_in_at ASC
			LIMIT 5`).bind(id).all().catch(() => ({ results: [] })),
		db.prepare('SELECT sku_id, sku_part_number, enabled_units, consumed_units FROM licenses_cache WHERE tenant_id = ?').bind(id).all().catch(() => ({ results: [] })),
		db.prepare("SELECT id, tenant_id, type, severity, title, description, source, status, estimated_cost_impact, affected_users, recommendations, created_at, resolved_at, resolved_by FROM alerts WHERE tenant_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 5").bind(id).all().catch(() => ({ results: [] })),
		db.prepare('SELECT last_sync_at FROM tenants WHERE id = ?').bind(id).first().catch(() => null),
	]);

	const alertCounts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const row of (alertResult?.results || []) as Array<{ severity: string; count: number }>) {
		if (row.severity in alertCounts) alertCounts[row.severity as keyof typeof alertCounts] = row.count;
	}

	let estimatedSpend = 0, estimatedWaste = 0;
	const licenseBreakdown: Array<{ skuName: string; assigned: number; total: number; costPerUnit: number }> = [];
	let totalLicenseUnits = 0, assignedLicenseUnits = 0;
	for (const row of licenseRows.results as Array<{ sku_id: string; sku_part_number: string; enabled_units: number; consumed_units: number }>) {
		const cost = getSkuCost(row.sku_part_number);
		const consumed = Number(row.consumed_units ?? 0);
		const total = Number(row.enabled_units ?? 0);
		const available = total - consumed;
		estimatedSpend += consumed * cost;
		estimatedWaste += Math.max(0, available) * cost;
		totalLicenseUnits += total;
		assignedLicenseUnits += consumed;
		if (total > 0) {
			licenseBreakdown.push({ skuName: row.sku_part_number || row.sku_id, assigned: consumed, total, costPerUnit: cost });
		}
	}

	const cachedScore = await c.env.KV.get(`securescore:${id}`, 'json') as { current?: number } | null;
	const us = userStats as Record<string, number> | null;
	const totalUsers = Number(us?.total ?? 0);
	const activeUsers = Number(us?.active ?? 0);
	let secureScore: number | null = cachedScore?.current ?? null;
	if (secureScore === null && totalUsers > 0) {
		const inactiveRatio = totalUsers > 0 ? (totalUsers - activeUsers) / totalUsers : 0;
		const critHigh = alertCounts.critical + alertCounts.high;
		secureScore = Math.max(0, Math.min(100, Math.round(80 - inactiveRatio * 30 - critHigh * 5)));
	}

	const userBreakdown = {
		total: totalUsers, active: activeUsers,
		inactive: Number(us?.inactive ?? 0), guests: 0,
		disabled: Number(us?.disabled ?? 0),
	};

	const nowSec = Math.floor(Date.now() / 1000);
	const topRiskyUsers = ((riskyUsersResult?.results || []) as Array<Record<string, unknown>>).map((u) => {
		const lastSignIn = u.last_sign_in_at ? Number(u.last_sign_in_at) : null;
		const daysSince = lastSignIn ? Math.floor((nowSec - lastSignIn) / 86400) : null;
		const enabled = Boolean(u.account_enabled);
		let reason = 'Unknown risk';
		if (!enabled) reason = 'Account disabled';
		else if (lastSignIn === null) reason = 'Never signed in';
		else if (daysSince !== null && daysSince >= 90) reason = `Inactive ${daysSince}d`;
		return {
			displayName: (u.display_name as string) || (u.user_principal_name as string) || '',
			email: (u.mail as string) || (u.user_principal_name as string) || '',
			riskReason: reason, daysSinceSignIn: daysSince, accountEnabled: enabled,
		};
	});

	const recentAlerts = ((recentAlertRows?.results || []) as Array<Record<string, unknown>>).map((r) => ({
		id: r.id as string, tenantId: r.tenant_id as string,
		severity: r.severity as string, type: r.type as string,
		title: r.title as string, description: r.description as string,
		source: (r.source as string) || null, status: r.status as string,
		estimatedCostImpact: r.estimated_cost_impact as number || 0,
		createdAt: r.created_at as string, resolvedAt: (r.resolved_at as string) || null,
	}));

	const lastSyncAt = (tenantRow as Record<string, unknown> | null)?.last_sync_at as string | null ?? null;
	const licenseUtilization = totalLicenseUnits > 0 ? Math.round((assignedLicenseUnits / totalLicenseUnits) * 100) : 0;

	return c.json({
		secureScore, secureScoreTrend: [], activeAlerts: alertCounts,
		totalUsers, activeUsers, licenseWaste: estimatedWaste,
		totalLicenseSpend: estimatedSpend, userBreakdown, topRiskyUsers,
		licenseUtilization, licenseBreakdown, recentAlerts, lastSyncAt,
	});
});
