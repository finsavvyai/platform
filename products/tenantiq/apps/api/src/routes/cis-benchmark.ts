/**
 * CIS Microsoft 365 Benchmark Scanner API Routes
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { requireSkill } from '../middleware/skill-gate';
import { GraphClient } from '../lib/graph-client';
import { fetchGraphData, runEvaluation, type ScanResult } from '../lib/cis/scanner';
import { ALL_CIS_CONTROLS, ALL_CIS_SECTIONS } from '../lib/cis/control-registry';
import { loadOverrides } from '../lib/cis/overrides';
import { getSelectedTenant } from '../lib/tenant-selector';
import { cisOverrideRoutes } from './cis-overrides';

export const cisBenchmarkRoutes = new Hono<AppEnv>();
cisBenchmarkRoutes.use('*', authMiddleware);
cisBenchmarkRoutes.route('/overrides', cisOverrideRoutes);

// POST /api/cis-benchmark/scan — Run a full CIS scan (skill-gated)
cisBenchmarkRoutes.post('/scan', requireSkill('cis'), async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant connected' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	// Check for Graph API tokens
	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) {
		return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);
	}

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const graphData = await fetchGraphData((path) => graph.fetch(path));
		const overrides = await loadOverrides(db, tenantId);
		const result = runEvaluation(graphData, overrides);

		const scannedAt = new Date().toISOString();

		// Cache result in KV
		await c.env.KV.put(`cis:${tenantId}:latest`, JSON.stringify({
			...result,
			tenantId,
			scannedAt,
		}), { expirationTtl: 3600 });

		// Store scan history (table created in migration 0020).
		const scanId = crypto.randomUUID();
		await db.prepare(
			`INSERT INTO cis_scans (id, tenant_id, org_id, overall_score, pass_count, fail_count, partial_count, total_controls, section_scores, scan_duration_ms, scanned_at, scanned_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			scanId, tenantId, user.orgId ?? null,
			result.overallScore, result.passCount, result.failCount, result.partialCount,
			result.totalControls, JSON.stringify(result.sectionScores ?? {}),
			result.scanDurationMs, scannedAt, user.email ?? user.sub ?? 'system',
		).run().catch(() => {});

		// Emit notification for CIS scan completion
		try {
			const { addNotification } = await import('../lib/notifications');
			await addNotification(c.env.KV, tenantId, {
				type: 'cis',
				title: 'CIS scan complete',
				message: `Score ${result.overallScore}/100 — ${result.passCount} passed, ${result.failCount} failed`,
			});
		} catch { /* non-blocking */ }

		return c.json({ success: true, result: { ...result, scannedAt } });
	} catch (err) {
		console.error('CIS scan failed:', err);
		return c.json({ error: 'CIS scan failed' }, 500);
	}
});

// POST /api/cis-benchmark/recheck — Re-evaluate a single control against cached Graph data
cisBenchmarkRoutes.post('/recheck', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);
	const body = await c.req.json<{ controlId?: string }>()
		.catch(() => ({} as { controlId?: string }));
	if (!body.controlId) return c.json({ error: 'controlId required' }, 400);

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	// Queue a full scan — single-control re-evaluation still needs fresh Graph data.
	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const graphData = await fetchGraphData((path) => graph.fetch(path));
		const overrides = await loadOverrides(c.env.DB, tenantId);
		const result = runEvaluation(graphData, overrides);
		await c.env.KV.put(`cis:${tenantId}:latest`, JSON.stringify({
			...result, tenantId, scannedAt: new Date().toISOString(),
		}), { expirationTtl: 3600 });
		const control = result.controls.find((ct) => ct.controlId === body.controlId);
		return c.json({ success: true, control });
	} catch (err) {
		console.error('CIS recheck failed:', err);
		return c.json({ error: 'Re-check failed' }, 500);
	}
});

// POST /api/cis-benchmark/remediate — Apply automatic remediation for a control.
// `mode: 'graph'` uses Microsoft Graph REST; `mode: 'browser'` queues a Playwright job.
cisBenchmarkRoutes.post('/remediate', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);
	const body = await c.req.json<{ controlId?: string; mode?: 'graph' | 'browser' }>()
		.catch(() => ({} as { controlId?: string; mode?: 'graph' | 'browser' }));
	if (!body.controlId) return c.json({ error: 'controlId required' }, 400);

	if (body.mode === 'browser') {
		// Browser-based remediation is behind a Cloudflare Browser Rendering integration.
		// For now, log the request so the feature flag flips cleanly when wiring lands.
		console.info('[cis.remediate] browser remediation requested', { tenantId, controlId: body.controlId });
		return c.json({
			success: false,
			status: 'queued',
			message: 'Browser remediation is in beta and not yet wired to Cloudflare Browser Rendering. Use "Open in Microsoft Entra" or Auto-fix via Graph while we finish the integration.',
		}, 202);
	}

	// Graph-based remediation is per-control. Only a subset of controls have a
	// safe, idempotent Graph mutation mapped here; the rest return 501.
	console.info('[cis.remediate] graph remediation requested', { tenantId, controlId: body.controlId });
	return c.json({
		success: false,
		status: 'not_implemented',
		message: 'Automatic Graph-based remediation for this control is not yet implemented. Follow the step-by-step fix guide to remediate manually.',
	}, 501);
});

// GET /api/cis-benchmark/latest — Get cached latest scan
cisBenchmarkRoutes.get('/latest', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`cis:${tenantId}:latest`, 'json');
	if (cached) return c.json(cached);
	return c.json({ overallScore: null, controls: [], totalControls: 0, message: 'No scan results yet. Run a CIS benchmark scan.' });
});

// GET /api/cis-benchmark/history — Scan history with scores
cisBenchmarkRoutes.get('/history', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ scans: [] });

	const result = await c.env.DB.prepare(
		'SELECT * FROM cis_scans WHERE tenant_id = ? ORDER BY scanned_at DESC LIMIT 20'
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ scans: result.results });
});

// GET /api/cis-benchmark/trend?days=30 — Time-series suitable for charting
cisBenchmarkRoutes.get('/trend', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ points: [] });

	const days = Math.min(365, Math.max(7, parseInt(c.req.query('days') ?? '30', 10) || 30));
	const since = new Date(Date.now() - days * 86400_000).toISOString();

	const rows = await c.env.DB.prepare(
		`SELECT date(scanned_at) AS day,
		        AVG(overall_score) AS score,
		        AVG(pass_count) AS pass,
		        AVG(fail_count) AS fail,
		        AVG(partial_count) AS partial,
		        COUNT(*) AS scans
		 FROM cis_scans
		 WHERE tenant_id = ? AND scanned_at >= ?
		 GROUP BY date(scanned_at)
		 ORDER BY day ASC`,
	).bind(tenantId, since).all<{ day: string; score: number; pass: number; fail: number; partial: number; scans: number }>()
		.catch(() => ({ results: [] }));

	const points = (rows.results ?? []).map(r => ({
		date: r.day,
		score: Math.round(r.score),
		passCount: Math.round(r.pass),
		failCount: Math.round(r.fail),
		partialCount: Math.round(r.partial),
		scansThatDay: r.scans,
	}));

	const latest = points[points.length - 1];
	const earliest = points[0];
	const delta = latest && earliest ? latest.score - earliest.score : 0;

	return c.json({
		points,
		summary: {
			windowDays: days,
			scanCount: points.reduce((s, p) => s + p.scansThatDay, 0),
			latestScore: latest?.score ?? null,
			earliestScore: earliest?.score ?? null,
			scoreDelta: delta,
			direction: delta > 5 ? 'improving' : delta < -5 ? 'regressing' : 'stable',
		},
	});
});

// POST /api/cis-benchmark/explain — AI-powered explanation of a failed control.
// Body: { controlId: string }. Returns Claude analysis cached 24h in KV.
// Optimize365 ships static remediation text; we generate context-aware
// explanations grounded in the actual currentValue + tenant Graph data.
cisBenchmarkRoutes.post('/explain', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{ controlId?: string }>().catch(() => ({} as { controlId?: string }));
	if (!body.controlId) return c.json({ error: 'controlId required' }, 400);
	const controlId = body.controlId;

	const cacheKey = `cis:explain:${tenantId}:${controlId}`;
	const cached = await c.env.KV.get(cacheKey, 'json');
	if (cached) return c.json({ ...cached, source: 'cache' });

	const latestRaw = await c.env.KV.get(`cis:${tenantId}:latest`, 'json');
	const latest = latestRaw as { controls?: Array<{ controlId: string; title: string; status: string; currentValue: string; expectedValue: string; severity: string; remediationHint: string }> } | null;
	const control = latest?.controls?.find(x => x.controlId === controlId);
	if (!control) {
		return c.json({ error: 'Control not in latest scan — run a scan first' }, 404);
	}

	if (!c.env.ANTHROPIC_API_KEY) {
		return c.json({
			explanation: control.remediationHint,
			actions: [],
			risk: `Failing this control with ${control.severity} severity affects baseline CIS posture.`,
			source: 'static-fallback',
		});
	}

	try {
		const { callAnthropic } = await import('../lib/ai-anthropic');
		const ctx = `CIS Control ${control.controlId} (${control.severity}): ${control.title}
Current value: ${control.currentValue}
Expected: ${control.expectedValue}
Static remediation hint: ${control.remediationHint}`;
		const question = `Explain this CIS finding to an MSP technician in 4-6 sentences. Cover:
1. What this control protects against (concrete attacker scenario)
2. Why the current value is non-compliant
3. The exact Microsoft 365 admin steps to remediate (portal path, not just "configure")
4. One follow-up control to check after fixing this one
Keep it data-rich. No "review your policies" platitudes.`;
		const text = await callAnthropic(c.env.ANTHROPIC_API_KEY, ctx, question);

		const result = {
			controlId,
			explanation: text,
			source: 'claude',
			generatedAt: new Date().toISOString(),
		};
		await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
		return c.json(result);
	} catch (err) {
		console.error('[cis.explain] Claude call failed', err);
		return c.json({
			explanation: control.remediationHint,
			source: 'static-fallback',
			error: err instanceof Error ? err.message : 'AI unavailable',
		});
	}
});

// GET /api/cis-benchmark/controls — Get control catalog
cisBenchmarkRoutes.get('/controls', async (c) => {
	return c.json({ controls: ALL_CIS_CONTROLS, sections: ALL_CIS_SECTIONS });
});
