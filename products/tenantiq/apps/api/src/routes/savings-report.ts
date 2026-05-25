/**
 * Branded Savings Report — shareable HTML report MSPs send to clients.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSkuCost } from '../lib/constants';
import { generateReportHTML, type ReportSection } from '../lib/pdf-generator';

export const savingsReportRoutes = new Hono<AppEnv>();
savingsReportRoutes.use('*', authMiddleware);

const PERIOD_DAYS: Record<string, number> = { '30d': 30, '90d': 90, '1y': 365 };
const PERIOD_LABELS: Record<string, string> = {
	'30d': 'Last 30 Days',
	'90d': 'Last 90 Days',
	'1y': 'Last 12 Months',
};

/** POST /generate — create branded savings report as HTML */
savingsReportRoutes.post('/generate', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'Organization required' }, 400);

	const body = await c.req.json<{
		tenantId: string;
		period?: string;
		includeSecurityImprovements?: boolean;
	}>().catch(() => null);

	if (!body?.tenantId) {
		return c.json({ error: 'tenantId is required' }, 400);
	}

	const period = body.period && body.period in PERIOD_DAYS ? body.period : '30d';
	const db = c.env.DB;

	try {
		const tenant = await db
			.prepare('SELECT id, display_name, domain FROM tenants WHERE id = ? AND organization_id = ?')
			.bind(body.tenantId, orgId)
			.first()
			.catch(() => null);

		if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

		const sections = await buildReportSections(
			db, c.env, body.tenantId, period,
			body.includeSecurityImprovements ?? true,
		);

		const savings = await getTotalSavings(db, c.env, body.tenantId);

		const html = generateReportHTML({
			title: `${(tenant as any).display_name} Savings Report`,
			subtitle: `Value delivered — ${PERIOD_LABELS[period]}`,
			generatedAt: new Date().toISOString(),
			sections: [
				{
					heading: 'Executive Summary',
					content: `We saved you $${savings.toLocaleString()} this period through license optimization, security improvements, and automated compliance.`,
					metrics: [{ label: 'Total Savings', value: `$${savings.toLocaleString()}` }],
				},
				...sections,
				{
					heading: '',
					content: 'Powered by TenantIQ — AI-Powered Microsoft 365 Intelligence for MSPs',
				},
			],
		});

		return c.html(html);
	} catch (err) {
		console.error('Savings report failed:', err);
		return c.json({ error: 'Failed to generate savings report' }, 500);
	}
});

async function getTotalSavings(db: D1Database, env: any, tenantId: string): Promise<number> {
	const cached = await env.KV.get(`savings:${tenantId}`).catch(() => null);
	if (cached) return Number(cached);
	return computeLicenseWaste(db, tenantId);
}

async function computeLicenseWaste(db: D1Database, tenantId: string): Promise<number> {
	const rows = await db
		.prepare('SELECT sku_part_number, consumed_units, enabled_units FROM licenses_cache WHERE tenant_id = ?')
		.bind(tenantId).all().catch(() => ({ results: [] }));

	let waste = 0;
	for (const r of rows.results as any[]) {
		const consumed = Number(r.consumed_units ?? 0);
		const enabled = Number(r.enabled_units ?? 0);
		if (enabled > consumed) waste += (enabled - consumed) * getSkuCost(r.sku_part_number);
	}
	return Math.round(waste);
}

async function buildReportSections(
	db: D1Database, env: any, tenantId: string,
	period: string, includeSecurity: boolean,
): Promise<ReportSection[]> {
	const sections: ReportSection[] = [];
	const waste = await computeLicenseWaste(db, tenantId);

	sections.push({
		heading: 'License Optimization',
		content: `Identified $${waste.toLocaleString()}/mo in unused license spend. Reclaiming these licenses directly reduces your Microsoft 365 costs.`,
		metrics: [
			{ label: 'Monthly Waste Detected', value: `$${waste.toLocaleString()}` },
			{ label: 'Annualized Savings', value: `$${(waste * 12).toLocaleString()}` },
		],
	});

	if (includeSecurity) {
		const scoreRaw = await env.KV.get(`secure-score:${tenantId}`).catch(() => null);
		const score = scoreRaw ? JSON.parse(scoreRaw) : null;
		sections.push({
			heading: 'Security Improvements',
			content: score
				? `Microsoft Secure Score improved from ${score.before ?? 'N/A'} to ${score.current ?? 'N/A'}.`
				: 'Security posture actively monitored with real-time threat detection.',
			metrics: score
				? [
						{ label: 'Score Before', value: String(score.before ?? 'N/A') },
						{ label: 'Score Now', value: String(score.current ?? 'N/A') },
					]
				: [{ label: 'Status', value: 'Active Monitoring' }],
		});
	}

	const remCount = await db
		.prepare("SELECT COUNT(*) as cnt FROM remediation_history WHERE tenant_id = ?")
		.bind(tenantId).first().catch(() => null);

	const actions = Number((remCount as any)?.cnt ?? 0);
	sections.push({
		heading: 'Actions Taken',
		content: `${actions} automated remediation actions executed to maintain compliance and security posture.`,
		metrics: [{ label: 'Remediation Actions', value: String(actions) }],
	});

	return sections;
}

export default savingsReportRoutes;
