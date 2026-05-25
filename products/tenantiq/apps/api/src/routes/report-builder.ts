/**
 * Report Builder API — custom metric reports with template persistence.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';

export const reportBuilderRoutes = new Hono<AppEnv>();
reportBuilderRoutes.use('*', authMiddleware);

type MetricType = 'number' | 'percentage' | 'currency' | 'trend';

interface MetricDefinition {
	id: string;
	name: string;
	category: string;
	type: MetricType;
}

const AVAILABLE_METRICS: MetricDefinition[] = [
	{ id: 'secure_score', name: 'Secure Score', category: 'Security', type: 'percentage' },
	{ id: 'mfa_rate', name: 'MFA Adoption Rate', category: 'Security', type: 'percentage' },
	{ id: 'alert_count', name: 'Active Alerts', category: 'Security', type: 'number' },
	{ id: 'cis_score', name: 'CIS Compliance Score', category: 'Compliance', type: 'percentage' },
	{ id: 'total_users', name: 'Total Users', category: 'Users', type: 'number' },
	{ id: 'active_users', name: 'Active Users', category: 'Users', type: 'number' },
	{ id: 'inactive_users', name: 'Inactive Users', category: 'Users', type: 'number' },
	{ id: 'total_licenses', name: 'Total Licenses', category: 'Licenses', type: 'number' },
	{ id: 'assigned_licenses', name: 'Assigned Licenses', category: 'Licenses', type: 'number' },
	{ id: 'license_waste', name: 'License Waste', category: 'Licenses', type: 'percentage' },
	{ id: 'monthly_cost', name: 'Monthly Cost', category: 'Costs', type: 'currency' },
	{ id: 'potential_savings', name: 'Potential Savings', category: 'Costs', type: 'currency' },
];

const generateSchema = z.object({
	metrics: z.array(z.string()).min(1, 'At least one metric is required'),
	period: z.enum(['7d', '30d', '90d', '1y']),
	title: z.string().max(200).optional(),
});

const templateSchema = z.object({
	name: z.string().min(1, 'Name is required').max(200),
	metrics: z.array(z.string()).min(1, 'At least one metric is required'),
	period: z.enum(['7d', '30d', '90d', '1y']),
	layout: z.enum(['grid', 'list', 'dashboard']).default('grid'),
});

// GET /api/report-builder/metrics — list available metrics
reportBuilderRoutes.get('/metrics', (c) => {
	return c.json({ metrics: AVAILABLE_METRICS });
});

// POST /api/report-builder/generate — generate report data
reportBuilderRoutes.post('/generate', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	try {
		const raw = await c.req.json().catch(() => null);
		const parsed = generateSchema.safeParse(raw);
		if (!parsed.success) {
			return c.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);
		}
		const body = parsed.data;

		const validIds = new Set(AVAILABLE_METRICS.map((m) => m.id));
		const invalid = body.metrics.filter((id) => !validIds.has(id));
		if (invalid.length) {
			return c.json({ error: `Unknown metrics: ${invalid.join(', ')}` }, 400);
		}

		const cached = await loadCachedMetrics(c.env.KV, tenantId);
		const widgets = body.metrics.map((id) => buildWidget(id, cached));

		return c.json({
			title: body.title || 'Custom Report',
			period: body.period,
			generatedAt: new Date().toISOString(),
			widgets,
		});
	} catch (err) {
		console.error('Report generation failed:', err);
		return c.json({ error: 'Generation failed' }, 500);
	}
});

// POST /api/report-builder/templates — save a report template
reportBuilderRoutes.post('/templates', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	try {
		const raw = await c.req.json().catch(() => null);
		const parsed = templateSchema.safeParse(raw);
		if (!parsed.success) {
			return c.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);
		}
		const body = parsed.data;

		const user = c.get('user');
		const id = crypto.randomUUID();
		const template = { id, ...body, createdBy: user.email, createdAt: new Date().toISOString() };
		const key = `report-template:${tenantId}:${id}`;

		await c.env.KV.put(key, JSON.stringify(template), { expirationTtl: 365 * 86400 });

		// Also update the index
		const indexKey = `report-templates:${tenantId}:index`;
		const existing = await c.env.KV.get(indexKey, 'json') as string[] | null;
		const index = existing || [];
		index.push(id);
		await c.env.KV.put(indexKey, JSON.stringify(index), { expirationTtl: 365 * 86400 });

		return c.json({ success: true, template });
	} catch (err) {
		console.error('Report template save failed:', err);
		return c.json({ error: 'Save failed' }, 500);
	}
});

// GET /api/report-builder/templates — list saved templates
reportBuilderRoutes.get('/templates', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);

	const indexKey = `report-templates:${tenantId}:index`;
	const index = await c.env.KV.get(indexKey, 'json') as string[] | null;
	if (!index?.length) return c.json({ templates: [] });

	const templates = await Promise.all(
		index.map((id) => c.env.KV.get(`report-template:${tenantId}:${id}`, 'json')),
	);

	return c.json({ templates: templates.filter(Boolean) });
});

interface CachedMetrics {
	secureScore?: number;
	mfaRate?: number;
	alertCount?: number;
	cisScore?: number;
	totalUsers?: number;
	activeUsers?: number;
	totalLicenses?: number;
	assignedLicenses?: number;
	monthlyCost?: number;
}

async function loadCachedMetrics(kv: KVNamespace, tenantId: string): Promise<CachedMetrics> {
	const [scores, alerts, users, licenses] = await Promise.all([
		kv.get(`tenant:${tenantId}:scores`, 'json').catch(() => null) as Promise<any>,
		kv.get(`alerts:${tenantId}:summary`, 'json').catch(() => null) as Promise<any>,
		kv.get(`tenant:${tenantId}:users`, 'json').catch(() => null) as Promise<any>,
		kv.get(`tenant:${tenantId}:licenses`, 'json').catch(() => null) as Promise<any>,
	]);

	return {
		secureScore: scores?.secureScore ?? 0,
		mfaRate: scores?.mfaRate ?? 0,
		alertCount: alerts?.count ?? 0,
		cisScore: scores?.cisScore ?? 0,
		totalUsers: users?.total ?? 0,
		activeUsers: users?.active ?? 0,
		totalLicenses: licenses?.total ?? 0,
		assignedLicenses: licenses?.assigned ?? 0,
		monthlyCost: licenses?.monthlyCost ?? 0,
	};
}

function buildWidget(metricId: string, cached: CachedMetrics) {
	const def = AVAILABLE_METRICS.find((m) => m.id === metricId)!;
	const valueMap: Record<string, number> = {
		secure_score: cached.secureScore ?? 0,
		mfa_rate: cached.mfaRate ?? 0,
		alert_count: cached.alertCount ?? 0,
		cis_score: cached.cisScore ?? 0,
		total_users: cached.totalUsers ?? 0,
		active_users: cached.activeUsers ?? 0,
		inactive_users: (cached.totalUsers ?? 0) - (cached.activeUsers ?? 0),
		total_licenses: cached.totalLicenses ?? 0,
		assigned_licenses: cached.assignedLicenses ?? 0,
		license_waste: cached.totalLicenses
			? Math.round(((cached.totalLicenses - (cached.assignedLicenses ?? 0)) / cached.totalLicenses) * 100)
			: 0,
		monthly_cost: cached.monthlyCost ?? 0,
		potential_savings: Math.round((cached.monthlyCost ?? 0) * 0.15),
	};

	return { metricId, name: def.name, type: def.type, category: def.category, value: valueMap[metricId] ?? 0 };
}
