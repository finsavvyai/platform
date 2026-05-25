/**
 * Copilot Readiness Assessment API — 7-category M365 Copilot readiness scan
 * with DB persistence, history, and PDF export.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { requireSkill } from '../middleware/skill-gate';
import { GraphClient } from '../lib/graph-client';
import { assessCopilotReadiness } from '../lib/copilot/readiness-engine';
import { generateReadinessReportHtml } from '../lib/copilot/readiness-report';
import type { ReadinessResult } from '../lib/copilot/readiness-types';
import { getSelectedTenant } from '../lib/tenant-selector';
import { notFound, validationError, forbidden } from '../lib/errors';

export const copilotReadinessRoutes = new Hono<AppEnv>();
copilotReadinessRoutes.use('*', authMiddleware);

// POST /api/copilot-readiness/assess — Run a full 7-category assessment
copilotReadinessRoutes.post('/assess', requireSkill('copilot'), async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant connected' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id, display_name FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string; display_name: string }>();
	if (!tenant?.azure_tenant_id) throw notFound('Tenant');

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);

	const assessId = crypto.randomUUID();
	const now = new Date().toISOString();

	// Insert pending record
	await db.prepare(
		'INSERT INTO copilot_assessments (id, org_id, tenant_id, overall_score, category_scores, recommendations, status, started_at, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)',
	).bind(assessId, user.orgId, tenantId, '{}', '[]', 'running', now, now).run().catch(() => {});

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const result = await assessCopilotReadiness((p) => graph.fetch(p));

		const catScores = JSON.stringify(
			Object.fromEntries(Object.entries(result.categories).map(([k, v]) => [k, v.score])),
		);

		// Update DB record
		await db.prepare(
			'UPDATE copilot_assessments SET overall_score = ?, category_scores = ?, recommendations = ?, status = ?, completed_at = ? WHERE id = ?',
		).bind(result.overallScore, catScores, JSON.stringify(result.recommendations), 'completed', result.assessedAt, assessId).run().catch(() => {});

		// Cache in KV for fast retrieval
		await c.env.KV.put(`copilot:${tenantId}:latest`, JSON.stringify(result), { expirationTtl: 7200 });

		return c.json({ success: true, result, assessmentId: assessId });
	} catch (err) {
		await db.prepare('UPDATE copilot_assessments SET status = ? WHERE id = ?').bind('failed', assessId).run().catch(() => {});
		console.error('Copilot readiness assessment failed:', err);
		return c.json({ error: 'Assessment failed' }, 500);
	}
});

// GET /api/copilot-readiness/latest — Get cached latest assessment
copilotReadinessRoutes.get('/latest', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`copilot:${tenantId}:latest`, 'json') as ReadinessResult | null;
	if (cached) return c.json(cached);
	return c.json({ overallScore: null, categories: null, recommendations: [], message: 'No assessment yet' });
});

// GET /api/copilot-readiness/history — Assessment history from DB
copilotReadinessRoutes.get('/history', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json([]);

	const rows = await c.env.DB.prepare(
		'SELECT id, overall_score, category_scores, completed_at FROM copilot_assessments WHERE tenant_id = ? AND org_id = ? AND status = ? ORDER BY completed_at DESC LIMIT 20',
	).bind(tenantId, user.orgId, 'completed').all().catch(() => ({ results: [] }));

	const history = (rows.results || []).map((r: any) => ({
		id: r.id,
		score: r.overall_score,
		categoryScores: JSON.parse(r.category_scores || '{}'),
		assessedAt: r.completed_at,
	}));
	return c.json(history);
});

// GET /api/copilot-readiness/benchmark — Compare tenant against org's tenants
copilotReadinessRoutes.get('/benchmark', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	// Get this tenant's latest score
	const cached = await c.env.KV.get(`copilot:${tenantId}:latest`, 'json') as ReadinessResult | null;
	if (!cached) return c.json({ error: 'No assessment. Run an assessment first.' }, 404);

	// Get all completed assessments for this org
	const rows = await c.env.DB.prepare(
		`SELECT tenant_id, overall_score, category_scores FROM copilot_assessments
		 WHERE org_id = ? AND status = 'completed'
		 AND id IN (SELECT MAX(id) FROM copilot_assessments WHERE org_id = ? AND status = 'completed' GROUP BY tenant_id)`
	).bind(user.orgId, user.orgId).all();

	const scores = (rows.results ?? []).map((r: any) => r.overall_score as number);
	const totalTenants = scores.length;
	const avgScore = totalTenants > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / totalTenants) : 0;

	// Calculate percentile ranking
	const belowCount = scores.filter((s) => s < cached.overallScore).length;
	const percentile = totalTenants > 1 ? Math.round((belowCount / (totalTenants - 1)) * 100) : 100;

	return c.json({
		tenantScore: cached.overallScore,
		orgAverage: avgScore,
		percentile,
		totalTenants,
		topScore: Math.max(...scores, 0),
		bottomScore: Math.min(...scores, 0),
	});
});

// GET /api/copilot-readiness/license-summary — Structured license + risk counts for Copilot panels
// v1: parsed from string details in KV-cached assessment. Structured numeric fields are v2.
copilotReadinessRoutes.get('/license-summary', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`copilot:${tenantId}:latest`, 'json') as ReadinessResult | null;
	if (!cached) return c.json({ error: 'No assessment. Run an assessment first.' }, 404);

	// copilotLicensed: parse seat count from licensing.checks detail string
	// e.g. "Copilot licenses available (45 seats)" -> 45
	const licensingChecks = cached.categories?.licensing?.checks ?? [];
	const copilotCheck = licensingChecks.find((ch: any) => ch.id === 'copilot_licenses') ?? licensingChecks[0];
	const copilotSeatsMatch = copilotCheck?.detail?.match(/(\d+)\s+seat/);
	const copilotLicensed = copilotSeatsMatch ? parseInt(copilotSeatsMatch[1], 10) : 0;

	// totalLicensed: look for "N total licensed users" pattern in licensing checks
	const totalCheck = licensingChecks.find((ch: any) => /total\s+licensed/i.test(ch.detail ?? ''));
	const totalMatch = totalCheck?.detail?.match(/(\d+)/);
	const totalLicensed = totalMatch ? parseInt(totalMatch[1], 10) : 0;

	// overshareRiskCount: v1 uses public group count as oversharing risk proxy. Per-user report is v2 (OVER-01).
	const collabChecks = cached.categories?.collaboration?.checks ?? [];
	const overshareCheck = collabChecks.find((ch: any) => /public_groups|oversharing/i.test(ch.id ?? ''));
	const overshareMatch = overshareCheck?.detail?.match(/(\d+)/);
	const overshareRiskCount = overshareMatch ? parseInt(overshareMatch[1], 10) : 0;

	// labelGapCount: v1 uses published label count as label coverage signal. Purview unlabeled file count is v2.
	const dpChecks = cached.categories?.dataProtection?.checks ?? [];
	const labelCheck = dpChecks.find((ch: any) => /sensitivity_labels|labels/i.test(ch.id ?? ''));
	const labelMatch = labelCheck?.detail?.match(/(\d+)/);
	const labelGapCount = labelMatch ? parseInt(labelMatch[1], 10) : 0;

	return c.json({ copilotLicensed, totalLicensed, overshareRiskCount, labelGapCount, assessedAt: cached.assessedAt });
});

// GET /api/copilot-readiness/export — Export latest assessment as HTML report
copilotReadinessRoutes.get('/export', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`copilot:${tenantId}:latest`, 'json') as ReadinessResult | null;
	if (!cached) throw notFound('Assessment — run an assessment first');

	const user = c.get('user');
	const tenant = await c.env.DB.prepare('SELECT display_name FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ display_name: string }>();

	const html = generateReadinessReportHtml(cached, tenant?.display_name || 'Tenant', user.name || 'Organization');
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
