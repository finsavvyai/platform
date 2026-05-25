/**
 * Push notification dispatcher — fans out a single alert to every subscribed
 * device for users in the target tenant's organization.
 *
 * Called from alert-generator.ts when new alerts are created. Non-blocking:
 * push is best-effort and never throws back to the alert creation path.
 *
 * Categories:
 *   - 'security' (default for alerts) — must be enabled in user prefs
 *   - 'remediation' / 'backup' / 'workflow' — for other system events
 */
import type { Env } from '../app/types';
import { sendPushNotification } from './web-push';

export interface DispatchableAlert {
	tenantId: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	body?: string;
	url?: string;
	category?: 'security' | 'remediation' | 'backup' | 'workflow';
}

export async function dispatchAlertPush(env: Env, alert: DispatchableAlert): Promise<{ users: number; sent: number }> {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { users: 0, sent: 0 };

	// 1. Resolve tenant → organization_id
	const tenant = await env.DB.prepare(`SELECT organization_id FROM tenants WHERE id = ?`)
		.bind(alert.tenantId).first<{ organization_id: string }>().catch(() => null);
	if (!tenant?.organization_id) return { users: 0, sent: 0 };

	// 2. Fan out to every platform_user in that org.
	const usersResult = await env.DB.prepare(`SELECT id FROM platform_users WHERE organization_id = ?`)
		.bind(tenant.organization_id).all<{ id: string }>().catch(() => ({ results: [] as { id: string }[] }));
	const userIds = (usersResult.results ?? []).map((u) => u.id);

	let sent = 0;
	for (const userId of userIds) {
		try {
			const ok = await sendPushNotification(env, userId, {
				title: alert.title,
				body: alert.body ?? `[${alert.severity}] ${alert.title}`,
				url: alert.url ?? '/alerts',
				category: alert.category ?? 'security',
			});
			if (ok) sent++;
		} catch (err) {
			console.error(`[push-dispatch] user ${userId} failed:`, err);
		}
	}

	console.log(`[push-dispatch] tenant=${alert.tenantId} users=${userIds.length} sent=${sent}`);
	return { users: userIds.length, sent };
}
