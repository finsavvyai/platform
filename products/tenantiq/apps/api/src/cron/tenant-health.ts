/**
 * Tenant Health Check Cron
 *
 * Runs every 15 minutes. Computes a health score per tenant based on:
 *   - Token validity (30 pts)
 *   - Sync freshness (25 pts)
 *   - CIS score (25 pts)
 *   - Active alerts (20 pts)
 *
 * Writes to platform_metrics and alerts if score drops below 50.
 */

import type { Env } from '../app/types';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { assertOrgId } from '../lib/org-scope-assert';

const ALERT_THRESHOLD = 50;
const MAX_SYNC_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface HealthComponents {
	tokenValidity: number;
	syncFreshness: number;
	cisScore: number;
	alertDeductions: number;
}

async function checkTokenValidity(kv: KVNamespace, azureTenantId: string | null): Promise<number> {
	if (!azureTenantId) return 0;
	const token = await kv.get(`graph:${azureTenantId}:access_token`);
	return token ? 30 : 0;
}

function computeSyncFreshness(lastSyncAt: string | Date | null): number {
	if (!lastSyncAt) return 0;
	const age = Date.now() - new Date(lastSyncAt).getTime();
	if (age <= MAX_SYNC_AGE_MS / 2) return 25;
	if (age <= MAX_SYNC_AGE_MS) return 15;
	if (age <= MAX_SYNC_AGE_MS * 2) return 5;
	return 0;
}

async function getCisScorePoints(kv: KVNamespace, tenantId: string): Promise<number> {
	const raw = await kv.get(`securescore:${tenantId}`, 'json') as { current: number } | null;
	if (!raw) return 0;
	return Math.round((raw.current / 100) * 25);
}

function computeAlertDeductions(criticalCount: number, highCount: number): number {
	const deduction = criticalCount * 5 + highCount * 2;
	return Math.max(0, 20 - deduction);
}

export async function runTenantHealthCheck(env: Env): Promise<void> {
	console.log('[TenantHealth] Starting health check');

	const db = getDb(env);
	const tenants = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.status, 'active'));

	let checked = 0;
	let alertsCreated = 0;

	for (const tenant of tenants) {
		// tenant.id is the organization ID — this handler queries the organizations table directly
		assertOrgId(tenant.id, 'TenantHealth');
		try {
			const [tokenPts, syncPts, cisPts] = await Promise.all([
				checkTokenValidity(env.KV, tenant.azureTenantId),
				Promise.resolve(computeSyncFreshness(tenant.lastSyncedAt)),
				getCisScorePoints(env.KV, tenant.id),
			]);

			// Count active critical/high alerts
			const alertRows = await env.DB.prepare(
				"SELECT severity, COUNT(*) as cnt FROM alerts WHERE tenant_id = ? AND status = 'active' AND severity IN ('critical', 'high') GROUP BY severity",
			).bind(tenant.id).all<{ severity: string; cnt: number }>();

			const criticalCount = alertRows.results?.find((r) => r.severity === 'critical')?.cnt ?? 0;
			const highCount = alertRows.results?.find((r) => r.severity === 'high')?.cnt ?? 0;
			const alertPts = computeAlertDeductions(criticalCount, highCount);

			const totalScore = tokenPts + syncPts + cisPts + alertPts;
			const now = Date.now();

			// Write to platform_metrics
			await env.DB.prepare(
				'INSERT INTO platform_metrics (id, metric_type, value, metadata, recorded_at) VALUES (?, ?, ?, ?, ?)',
			).bind(
				crypto.randomUUID(),
				`tenant_health:${tenant.id}`,
				totalScore,
				JSON.stringify({ token: tokenPts, sync: syncPts, cis: cisPts, alerts: alertPts }),
				now,
			).run();

			// Cache latest score for quick retrieval
			await env.KV.put(
				`health:${tenant.id}`,
				JSON.stringify({ score: totalScore, token: tokenPts, sync: syncPts, cis: cisPts, alerts: alertPts, updatedAt: now }),
				{ expirationTtl: 3600 },
			);

			// Alert if score drops below threshold
			if (totalScore < ALERT_THRESHOLD) {
				await env.DB.prepare(
					'INSERT INTO alerts (id, tenant_id, severity, type, title, description, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				).bind(
					crypto.randomUUID(),
					tenant.id,
					totalScore < 25 ? 'critical' : 'high',
					'health_score',
					`Tenant health score dropped to ${totalScore}/100`,
					`Token: ${tokenPts}/30, Sync: ${syncPts}/25, CIS: ${cisPts}/25, Alerts: ${alertPts}/20`,
					'intelligence_engine',
					'active',
					new Date().toISOString(),
					new Date().toISOString(),
				).run();
				alertsCreated++;
			}

			checked++;
		} catch (err) {
			console.error(`[TenantHealth] Failed for ${tenant.name}:`, err);
		}
	}

	console.log(`[TenantHealth] Complete: ${checked} tenants, ${alertsCreated} health alerts`);
}
