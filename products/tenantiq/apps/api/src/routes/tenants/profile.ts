/**
 * Tenant Profile Routes
 *
 * POST /:tenantId/profile  - Save company profile
 * GET  /:tenantId/profile  - Get company profile
 * GET  /:tenantId/security-baseline - Generate security baseline
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { generateSecurityBaseline } from '../../lib/security-baseline';

interface CompanyProfile {
	industry: string;
	companySize: string;
	compliance: string[];
	createdAt: string;
}

const app = new Hono<AppEnv>();

app.use('*', authMiddleware);
app.use('*', tenantMiddleware);

// POST /api/tenants/:tenantId/profile - Save company profile
app.post('/profile', async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json();

	if (!body.industry || !body.companySize) {
		return c.json({ error: 'industry and companySize are required' }, 400);
	}

	const profile: CompanyProfile = {
		industry: body.industry,
		companySize: body.companySize,
		compliance: Array.isArray(body.compliance) ? body.compliance : [],
		createdAt: new Date().toISOString(),
	};

	await c.env.KV.put(`profile:${tenantId}`, JSON.stringify(profile));

	// Best-effort update to organization record
	await c.env.DB.prepare(
		'UPDATE organizations SET industry = ?, company_size = ? WHERE id = (SELECT organization_id FROM tenants WHERE id = ?)',
	)
		.bind(profile.industry, profile.companySize, tenantId)
		.run()
		.catch(() => {});

	return c.json({ success: true });
});

// GET /api/tenants/:tenantId/profile - Get company profile
app.get('/profile', async (c) => {
	const tenantId = c.get('tenantId');
	const cached = await c.env.KV.get(`profile:${tenantId}`, 'json');
	if (cached) return c.json(cached);
	return c.json(null);
});

// GET /api/tenants/:tenantId/security-baseline - Security baseline
app.get('/security-baseline', async (c) => {
	const tenantId = c.get('tenantId');
	const profile = (await c.env.KV.get(
		`profile:${tenantId}`,
		'json',
	)) as CompanyProfile | null;

	if (!profile) {
		return c.json({ baseline: [], industry: 'unknown' });
	}

	const baseline = generateSecurityBaseline(
		profile.industry,
		profile.compliance || [],
	);

	return c.json({
		baseline,
		industry: profile.industry,
		compliance: profile.compliance,
	});
});

export default app;
