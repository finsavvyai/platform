import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth.middleware';
import { platformAdminMiddleware } from '../../middleware/admin-auth';

/**
 * Admin System Alerts Routes
 *
 * GET /system-alerts — platform-level alerts (high error rate, sync failures, quota limits)
 */

const adminAlerts = new Hono<AppEnv>();

adminAlerts.use('*', authMiddleware);
adminAlerts.use('*', platformAdminMiddleware);

interface SystemAlert {
	id: string;
	type: 'error_rate' | 'sync_failures' | 'quota_limit' | 'stale_tenant';
	severity: 'low' | 'medium' | 'high' | 'critical';
	title: string;
	description: string;
	detectedAt: number;
}

adminAlerts.get('/system-alerts', async (c) => {
	const db = c.env.DB;
	const now = Math.floor(Date.now() / 1000);
	const last24h = now - 86400;
	const alerts: SystemAlert[] = [];

	try {
		// Check for high sync failure rate
		const syncFailures = await db
			.prepare(
				`SELECT COUNT(*) as count FROM sync_jobs
				 WHERE status = 'failed' AND created_at > ?`
			)
			.bind(last24h)
			.first<{ count: number }>();

		if ((syncFailures?.count ?? 0) > 5) {
			alerts.push({
				id: 'sync-failures-24h',
				type: 'sync_failures',
				severity: (syncFailures?.count ?? 0) > 20 ? 'critical' : 'high',
				title: `${syncFailures?.count} sync failures in last 24h`,
				description: 'Multiple sync jobs have failed. Check tenant connections and Graph API status.',
				detectedAt: now,
			});
		}

		// Check for stale tenants (no sync in 7 days)
		const staleTenants = await db
			.prepare(
				`SELECT COUNT(*) as count FROM tenants
				 WHERE status = 'active' AND (last_sync_at IS NULL OR last_sync_at < ?)`
			)
			.bind(now - 604800)
			.first<{ count: number }>();

		if ((staleTenants?.count ?? 0) > 0) {
			alerts.push({
				id: 'stale-tenants',
				type: 'stale_tenant',
				severity: 'medium',
				title: `${staleTenants?.count} tenants with stale data`,
				description: 'These tenants have not synced in over 7 days.',
				detectedAt: now,
			});
		}

		// Check for high active alert count
		const activeAlerts = await db
			.prepare(
				`SELECT COUNT(*) as count FROM security_alerts
				 WHERE status = 'active' AND severity IN ('high', 'critical')`
			)
			.first<{ count: number }>();

		if ((activeAlerts?.count ?? 0) > 10) {
			alerts.push({
				id: 'high-severity-alerts',
				type: 'error_rate',
				severity: 'high',
				title: `${activeAlerts?.count} unresolved high/critical alerts`,
				description: 'Large number of high-severity security alerts require attention.',
				detectedAt: now,
			});
		}

		return c.json({ alerts });
	} catch (err) {
		console.error('Admin system-alerts error:', err);
		return c.json({ error: 'Failed to load system alerts' }, 500);
	}
});

export default adminAlerts;
