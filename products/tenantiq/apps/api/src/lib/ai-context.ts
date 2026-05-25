/**
 * AI Context Builder — loads rich tenant data for AI prompts.
 * Queries D1 + KV to build a complete picture the LLM can reference.
 */

import { eq } from 'drizzle-orm';
import { tenants, usersCache, licensesCache, securityAlerts } from '@tenantiq/db/schema-d1';
import { getSkuCost } from './constants';
import type { TenantContext } from './ai-anthropic';

type DB = ReturnType<typeof import('./db').getDb>;

function timeAgo(epochMs: number): string {
	const diff = Date.now() - epochMs;
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

async function loadCisScore(kv: KVNamespace, tid: string): Promise<{ score: number; scannedAt: string } | null> {
	try {
		const raw = await kv.get(`cis:${tid}:latest`, 'json') as { overallScore?: number; scannedAt?: string } | null;
		if (raw?.overallScore != null) return { score: raw.overallScore, scannedAt: raw.scannedAt || 'unknown' };
	} catch { /* KV miss */ }
	return null;
}

export async function loadCtx(db: DB, tid: string, kv?: KVNamespace): Promise<TenantContext | null> {
	const [t] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
	if (!t) return null;

	const [users, lics, als] = await Promise.all([
		db.select().from(usersCache).where(eq(usersCache.tenantId, tid)),
		db.select().from(licensesCache).where(eq(licensesCache.tenantId, tid)),
		db.select().from(securityAlerts).where(eq(securityAlerts.tenantId, tid)).limit(50),
	]);

	const now = Date.now();
	const inactive = users.filter(u => !u.lastSignInAt || (now - u.lastSignInAt) / 86400000 > 90);
	const disabled = users.filter(u => !u.accountEnabled);
	const guests = users.filter(u => u.userPrincipalName?.includes('#EXT#'));
	const activeUsers = users.filter(u => u.accountEnabled && u.lastSignInAt && (now - u.lastSignInAt) / 86400000 <= 90);

	const licenseDetails = lics.map(l => {
		const consumed = l.consumedUnits ?? 0;
		const enabled = l.enabledUnits ?? 0;
		const cost = getSkuCost(l.skuPartNumber);
		const unused = Math.max(0, enabled - consumed);
		return { name: l.skuPartNumber, consumed, enabled, costPerUnit: cost, unused, wastePerMonth: unused * cost };
	});

	const totalSpend = licenseDetails.reduce((s, l) => s + l.consumed * l.costPerUnit, 0);
	const totalWaste = licenseDetails.reduce((s, l) => s + l.wastePerMonth, 0);

	const activeAlerts = als.filter(a => a.status === 'active');
	const bySeverity: Record<string, number> = {};
	for (const a of activeAlerts) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

	const cisData = kv ? await loadCisScore(kv, tid) : null;
	const lastSyncAgo = t.lastSyncAt ? timeAgo(t.lastSyncAt * 1000) : 'never';

	return {
		displayName: t.displayName,
		domain: t.domain || t.azureTenantId,
		status: t.status ?? 'unknown',
		lastSyncAgo,
		userCount: users.length,
		activeUserCount: activeUsers.length,
		inactiveCount: inactive.length,
		disabledCount: disabled.length,
		guestCount: guests.length,
		mfaDisabledCount: disabled.length,
		licenses: licenseDetails,
		totalSpend,
		totalWaste,
		alerts: als.map(a => ({ severity: a.severity, title: a.title, status: a.status ?? 'active' })),
		alertsBySeverity: bySeverity,
		activeAlertCount: activeAlerts.length,
		cisScore: cisData?.score ?? null,
		cisScannedAt: cisData?.scannedAt ?? null,
	};
}
