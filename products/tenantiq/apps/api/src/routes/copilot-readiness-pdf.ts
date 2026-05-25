/**
 * Copilot Readiness PDF Export Route
 * Generates HTML report, stores in R2 with 7-day TTL, returns downloadable content.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { generateReadinessReportHtml } from '../lib/copilot/readiness-report';
import type { ReadinessResult } from '../lib/copilot/readiness-types';
import { getSelectedTenant } from '../lib/tenant-selector';

export const copilotReadinessPdfRoutes = new Hono<AppEnv>();
copilotReadinessPdfRoutes.use('*', authMiddleware);

// GET /api/copilot-readiness/:id/pdf — Download assessment as HTML report
copilotReadinessPdfRoutes.get('/:id/pdf', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const assessmentId = c.req.param('id');
	const user = c.get('user');

	// Check R2 cache first
	const r2Key = `reports/copilot/${tenantId}/${assessmentId}.html`;
	const cached = await c.env.R2.get(r2Key);
	if (cached) {
		const html = await cached.text();
		return new Response(html, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Content-Disposition': `inline; filename="copilot-readiness-${assessmentId}.html"`,
			},
		});
	}

	// Load assessment from DB
	const row = await c.env.DB.prepare(
		'SELECT overall_score, category_scores, recommendations, completed_at FROM copilot_assessments WHERE id = ? AND tenant_id = ?',
	).bind(assessmentId, tenantId).first<{
		overall_score: number;
		category_scores: string;
		recommendations: string;
		completed_at: string;
	}>();

	if (!row) return c.json({ error: 'Assessment not found' }, 404);

	// Reconstruct ReadinessResult from DB row
	const catScores = JSON.parse(row.category_scores || '{}');
	const recs = JSON.parse(row.recommendations || '[]');
	const categories = Object.fromEntries(
		Object.entries(catScores).map(([k, score]) => [k, { score: score as number, checks: [] }]),
	) as unknown as ReadinessResult['categories'];
	const result: ReadinessResult = {
		overallScore: row.overall_score,
		categories,
		recommendations: recs,
		assessedAt: row.completed_at,
	};

	const tenant = await c.env.DB.prepare('SELECT display_name FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ display_name: string }>();

	const html = generateReadinessReportHtml(
		result,
		tenant?.display_name || 'Tenant',
		user.name || 'Organization',
	);

	// Store in R2 with 7-day expiry metadata
	await c.env.R2.put(r2Key, html, {
		httpMetadata: { contentType: 'text/html' },
		customMetadata: { expiresAt: String(Date.now() + 7 * 24 * 60 * 60 * 1000) },
	}).catch(() => {});

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Disposition': `inline; filename="copilot-readiness-${assessmentId}.html"`,
		},
	});
});
