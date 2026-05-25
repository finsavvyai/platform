/**
 * Alert Generator — creates actionable security alerts from synced tenant data.
 * Runs after each sync and during security scan cron.
 */
import { getSkuCost } from './constants';
import {
	type AlertType, type UserRow, type LicenseRow,
	checkInactiveUsers, checkStaleAccounts, checkDisabledAccounts,
	checkGuestAccess, checkLicenseWaste,
} from './alert-checks';

export type { AlertType, UserRow, LicenseRow, WasteResult } from './alert-checks';
export { checkInactiveUsers, checkStaleAccounts, checkDisabledAccounts, checkGuestAccess, checkLicenseWaste } from './alert-checks';

async function getActiveAlertTypes(db: D1Database, tenantId: string): Promise<Set<string>> {
	const result = await db.prepare(
		"SELECT type FROM alerts WHERE tenant_id = ? AND status = 'active'"
	).bind(tenantId).all().catch(() => ({ results: [] }));
	return new Set((result.results as any[]).map((r) => r.type));
}

async function resolveAlert(db: D1Database, tenantId: string, alertType: string): Promise<void> {
	await db.prepare(
		"UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE tenant_id = ? AND type = ? AND status = 'active'"
	).bind(new Date().toISOString(), tenantId, alertType).run().catch(() => {});
}

async function insertAlert(
	db: D1Database, tenantId: string, type: AlertType, severity: string,
	title: string, description: string, affected: number,
	savings: number, metadata: Record<string, unknown>,
): Promise<void> {
	const now = new Date().toISOString();
	await db.prepare(
		'INSERT INTO alerts (id, tenant_id, type, severity, title, description, source, status, affected_users, estimated_cost_impact, metadata, recommendations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
	).bind(
		crypto.randomUUID(), tenantId, type, severity, title, description,
		'alert-generator', 'active', String(affected), savings,
		JSON.stringify(metadata), JSON.stringify([]),
		now, now,
	).run().catch((err) => console.error(`[AlertGen] Insert failed for ${type}:`, err));
}

async function processCheck(
	db: D1Database, tenantId: string, existing: Set<string>,
	alertType: AlertType, items: unknown[], buildAlert: () => Parameters<typeof insertAlert> extends [any, any, ...infer R] ? R : never,
): Promise<number> {
	if (items.length > 0) {
		if (!existing.has(alertType)) {
			const [type, severity, title, desc, affected, savings, meta] = buildAlert();
			await insertAlert(db, tenantId, type, severity, title, desc, affected, savings, meta);
			return 1;
		}
	} else {
		await resolveAlert(db, tenantId, alertType);
	}
	return 0;
}

export interface AlertGenContext {
	db: D1Database;
	kv?: KVNamespace;
	/** Optional full env — if provided, web push notifications dispatch on new alerts. */
	env?: import('../app/types').Env;
}

export async function generateAlerts(tenantId: string, db: D1Database, kv?: KVNamespace): Promise<number> {
	const now = Date.now();
	let created = 0;

	const [userResult, licenseResult] = await Promise.all([
		db.prepare('SELECT * FROM users_cache WHERE tenant_id = ?').bind(tenantId).all(),
		db.prepare('SELECT * FROM licenses_cache WHERE tenant_id = ?').bind(tenantId).all(),
	]).catch(() => [{ results: [] }, { results: [] }]) as [D1Result, D1Result];

	const users = (userResult.results ?? []) as unknown as UserRow[];
	const licenses = (licenseResult.results ?? []) as unknown as LicenseRow[];
	const existing = await getActiveAlertTypes(db, tenantId);

	// Helper to enrich a user row with fields that SELECT * returns but UserRow doesn't declare.
	const enrich = (u: UserRow & Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
		name: u.display_name,
		email: (u as any).mail || u.user_principal_name,
		jobTitle: (u as any).job_title || undefined,
		department: (u as any).department || undefined,
		enabled: u.account_enabled ? 'Yes' : 'No',
		...extra,
	});

	// 1. Inactive users (90+ days)
	const inactive = checkInactiveUsers(users, now);
	const severe = inactive.filter((u) => u.daysSince >= 180);
	created += await processCheck(db, tenantId, existing, 'inactive_user', inactive, () => {
		const severity = severe.length > 0 ? 'high' : 'medium';
		const days = severe.length > 0 ? '180+' : '90+';
		return ['inactive_user', severity,
			`${inactive.length} user${inactive.length > 1 ? 's' : ''} inactive for ${days} days`,
			`Found ${inactive.length} enabled account(s) with no sign-in activity for ${days} days. Consider disabling or removing these accounts to reduce risk.`,
			inactive.length, 0,
			{ users: inactive.slice(0, 20).map((u) => enrich(u as any, { daysSinceSignIn: u.daysSince })) }];
	});

	// 2. Disabled accounts
	const disabled = checkDisabledAccounts(users);
	created += await processCheck(db, tenantId, existing, 'disabled_account', disabled, () => [
		'disabled_account', 'low',
		`${disabled.length} disabled account${disabled.length > 1 ? 's' : ''} still in directory`,
		`${disabled.length} disabled account(s) remain in your Azure AD directory. Review and remove accounts that are no longer needed to maintain a clean directory.`,
		disabled.length, 0, { users: disabled.slice(0, 20).map((u) => enrich(u as any)) },
	]);

	// 3. License waste
	const waste = checkLicenseWaste(licenses, getSkuCost);
	const totalWaste = waste.reduce((s, w) => s + w.monthlyCost, 0);
	created += await processCheck(db, tenantId, existing, 'license_waste', waste, () => [
		'license_waste', totalWaste > 50 ? 'high' : 'medium',
		`$${Math.round(totalWaste)}/mo wasted across ${waste.length} SKU${waste.length > 1 ? 's' : ''}`,
		`${waste.length} license SKU(s) have >20% unassigned licenses. Total estimated waste: $${Math.round(totalWaste)}/month.`,
		0, totalWaste, { skus: waste },
	]);

	// 4. Guest access (stale guests)
	const guests = checkGuestAccess(users, now);
	created += await processCheck(db, tenantId, existing, 'guest_access', guests, () => [
		'guest_access', 'low',
		`${guests.length} guest user${guests.length > 1 ? 's' : ''} with no recent activity`,
		`${guests.length} external guest account(s) have not signed in for 30+ days. Review guest access to reduce your external attack surface.`,
		guests.length, 0, { users: guests.slice(0, 20).map((u) => enrich(u as any)) },
	]);

	// 5. Stale accounts (enabled, never signed in)
	const stale = checkStaleAccounts(users);
	created += await processCheck(db, tenantId, existing, 'stale_account', stale, () => [
		'stale_account', 'medium',
		`${stale.length} enabled account${stale.length > 1 ? 's' : ''} never signed in`,
		`${stale.length} enabled account(s) have never recorded a sign-in. These may be provisioned but unused accounts that should be reviewed.`,
		stale.length, 0, { users: stale.slice(0, 20).map((u) => enrich(u as any)) },
	]);

	if (created > 0) {
		console.log(`[AlertGen] ${tenantId}: created ${created} new alerts`);
		try {
			if (!kv) throw new Error('no kv');
			const { addNotification } = await import('./notifications');
			await addNotification(kv, tenantId, {
				type: 'alert',
				title: 'New security alerts',
				message: `${created} new security alert${created > 1 ? 's' : ''} generated`,
			});
		} catch { /* non-blocking */ }
	}
	return created;
}

/**
 * Wrapper that also dispatches web push to subscribed users on new alerts.
 * Prefer this over `generateAlerts(tenantId, db, kv)` from cron paths that
 * have full env access — pass `env` to enable push dispatch.
 */
export async function generateAlertsWithPush(tenantId: string, env: import('../app/types').Env): Promise<number> {
	const created = await generateAlerts(tenantId, env.DB, env.KV);
	if (created > 0) {
		try {
			const { dispatchAlertPush } = await import('./push-dispatch');
			await dispatchAlertPush(env, {
				tenantId,
				severity: 'high',
				title: `${created} new security alert${created > 1 ? 's' : ''}`,
				body: `New issues detected in your tenant. Tap to review.`,
				url: '/alerts',
				category: 'security',
			});
		} catch (err) {
			console.error('[AlertGen] push dispatch failed:', err);
		}
	}
	return created;
}
