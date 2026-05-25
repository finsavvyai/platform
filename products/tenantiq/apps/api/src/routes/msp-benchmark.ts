/**
 * MSP Multi-Tenant Benchmarking — compare metrics across managed tenants.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { kvCache } from '../middleware/cache';

export const mspBenchmarkRoutes = new Hono<AppEnv>();
mspBenchmarkRoutes.use('*', authMiddleware);

// GET /api/msp-benchmark — Cross-tenant comparison
mspBenchmarkRoutes.get('/', kvCache({ ttl: 300, prefix: 'msp-benchmark' }), async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ tenants: [], benchmarks: {} });

	const db = c.env.DB;

	// Get all tenants for this org
	const tenantsResult = await db.prepare(
		'SELECT id, display_name, domain, status, last_sync_at FROM tenants WHERE organization_id = ?'
	).bind(orgId).all().catch(() => ({ results: [] }));

	const tenants: Array<{ id: string; name: string; domain: string; status: string; lastSync: string; totalUsers: number; activeUsers: number; activeRate: number; licenseUtilization: number; activeAlerts: number; cisScore: number | null }> = [];
	for (const t of tenantsResult.results as Array<{ id: string; display_name: string; domain: string; status: string; last_sync_at: string }>) {
		// Get per-tenant metrics
		const [userCount, licenseData, alertCount, cisScore] = await Promise.all([
			db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN account_enabled = 1 THEN 1 ELSE 0 END) as active FROM users_cache WHERE tenant_id = ?').bind(t.id).first().catch(() => null),
			db.prepare('SELECT SUM(consumed_units) as consumed, SUM(enabled_units) as enabled FROM licenses_cache WHERE tenant_id = ?').bind(t.id).first().catch(() => null),
			db.prepare("SELECT COUNT(*) as total FROM alerts WHERE tenant_id = ? AND status = 'active'").bind(t.id).first().catch(() => null),
			c.env.KV.get(`cis:${t.id}:latest`, 'json').catch(() => null) as Promise<{ overallScore?: number } | null>,
		]);

		const totalUsers = Number((userCount as any)?.total ?? 0);
		const activeUsers = Number((userCount as any)?.active ?? 0);
		const consumed = Number((licenseData as any)?.consumed ?? 0);
		const enabled = Number((licenseData as any)?.enabled ?? 0);

		tenants.push({
			id: t.id,
			name: t.display_name,
			domain: t.domain,
			status: t.status,
			lastSync: t.last_sync_at,
			totalUsers,
			activeUsers,
			activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
			licenseUtilization: enabled > 0 ? Math.round((consumed / enabled) * 100) : 0,
			activeAlerts: Number((alertCount as any)?.total ?? 0),
			cisScore: (cisScore as any)?.overallScore ?? null,
		});
	}

	// Compute benchmarks (averages across all tenants)
	const withUsers = tenants.filter(t => t.totalUsers > 0);
	const benchmarks = {
		avgActiveRate: withUsers.length > 0 ? Math.round(withUsers.reduce((s, t) => s + t.activeRate, 0) / withUsers.length) : 0,
		avgLicenseUtil: withUsers.length > 0 ? Math.round(withUsers.reduce((s, t) => s + t.licenseUtilization, 0) / withUsers.length) : 0,
		avgCisScore: withUsers.filter(t => t.cisScore != null).length > 0 ? Math.round(withUsers.filter(t => t.cisScore != null).reduce((s, t) => s + (t.cisScore ?? 0), 0) / withUsers.filter(t => t.cisScore != null).length) : null,
		totalAlerts: tenants.reduce((s, t) => s + t.activeAlerts, 0),
		totalUsers: tenants.reduce((s, t) => s + t.totalUsers, 0),
	};

	return c.json({ tenants, benchmarks });
});
