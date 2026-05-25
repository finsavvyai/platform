/**
 * Scheduled Scans Cron — runs CIS benchmark + config snapshot for all active tenants.
 * Triggered by the daily 0 3 * * * cron alongside compliance scan.
 */

import type { Env } from '../app/types';
import { GraphClient } from '../lib/graph-client';
import { assertOrgId } from '../lib/org-scope-assert';

export async function runScheduledScans(env: Env) {
	console.log('[ScheduledScans] Starting daily scans');

	const tenants = await env.DB.prepare(
		"SELECT id, azure_tenant_id, organization_id FROM tenants WHERE status = 'active'"
	).all().catch(() => ({ results: [] }));

	for (const t of tenants.results as Array<{ id: string; azure_tenant_id: string; organization_id: string | null }>) {
		assertOrgId(t.organization_id, 'ScheduledScans');
		if (!t.azure_tenant_id) continue;

		// Check for Graph tokens
		const hasToken = await env.KV.get(`graph:${t.azure_tenant_id}:access_token`) ||
			await env.KV.get(`graph:${t.azure_tenant_id}:refresh_token`);
		if (!hasToken) continue;

		const graph = new GraphClient(env as any, t.azure_tenant_id);

		// CIS Benchmark scan
		try {
			const { fetchGraphData, runEvaluation } = await import('../lib/cis/scanner');
			const { loadOverrides } = await import('../lib/cis/overrides');
			const graphData = await fetchGraphData((p) => graph.fetch(p));
			const overrides = await loadOverrides(env.DB, t.id);
			const result = runEvaluation(graphData, overrides);

			await env.KV.put(`cis:${t.id}:latest`, JSON.stringify({
				...result, tenantId: t.id, scannedAt: new Date().toISOString(),
			}), { expirationTtl: 86400 });

			await env.DB.prepare(
				'INSERT INTO cis_scans (id, tenant_id, overall_score, pass_count, fail_count, partial_count, total_controls, scan_duration_ms, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
			).bind(crypto.randomUUID(), t.id, result.overallScore, result.passCount, result.failCount, result.partialCount, result.totalControls, result.scanDurationMs, new Date().toISOString())
				.run().catch(() => {});

			console.log(`[ScheduledScans] CIS: ${t.id} score=${result.overallScore}`);
		} catch (err) {
			console.error(`[ScheduledScans] CIS failed for ${t.id}:`, err);
		}

		// Config snapshot (with drift detection built in)
		try {
			const { captureSnapshot } = await import('../lib/snapshots/capture');
			const manifest = await captureSnapshot(
				(p) => graph.fetch(p), env.KV, env.DB, t.id, 'system-cron', `Daily snapshot ${new Date().toLocaleDateString()}`
			);
			console.log(`[ScheduledScans] Snapshot: ${t.id} cats=${manifest.categories.length}`);
		} catch (err) {
			console.error(`[ScheduledScans] Snapshot failed for ${t.id}:`, err);
		}

		// Secure Score refresh
		try {
			const { fetchSecureScore } = await import('../lib/secure-score');
			await fetchSecureScore((p) => graph.fetch(p), env.KV, t.id);
		} catch { /* non-critical */ }
	}

	console.log('[ScheduledScans] Complete');
}
