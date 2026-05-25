/**
 * Storage Compliance API — retention, sharing, and compliance reporting.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import { generateComplianceReport } from '../lib/storage/compliance-checker';
import type { ComplianceReport } from '../lib/storage/compliance-checker';

export const storageComplianceRoutes = new Hono<AppEnv>();
storageComplianceRoutes.use('*', authMiddleware);

// GET /api/tenants/:tenantId/storage/compliance — run or retrieve compliance report
storageComplianceRoutes.get('/compliance', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant connected' }, 400);

	// Check KV cache first
	const cached = await c.env.KV.get(`storage-compliance:${tenantId}`, 'json') as ComplianceReport | null;
	if (cached) return c.json(cached);

	return c.json({
		tenantId,
		scannedAt: null,
		retention: { total: 0, withPolicy: 0, withoutPolicy: 0, findings: [] },
		sharing: { total: 0, overShared: 0, findings: [] },
		overallScore: 0,
		recommendations: ['Run a compliance scan to generate findings.'],
	});
});

// POST /api/tenants/:tenantId/storage/compliance/scan — trigger scan
storageComplianceRoutes.post('/compliance/scan', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant connected' }, 400);

	const row = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!row?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const hasToken = await c.env.KV.get(`graph:${row.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${row.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token' }, 403);

	try {
		const graph = new GraphClient(c.env as any, row.azure_tenant_id);
		const report = await generateComplianceReport(graph, tenantId);

		// Cache for 2 hours
		await c.env.KV.put(`storage-compliance:${tenantId}`, JSON.stringify(report), { expirationTtl: 7200 });

		// Persist to DB
		await c.env.DB.prepare(
			`INSERT INTO storage_compliance_scans (id, org_id, tenant_id, overall_score, retention_count, sharing_overshared, recommendations, scanned_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(
			crypto.randomUUID(), c.get('user').orgId, tenantId,
			report.overallScore, report.retention.total, report.sharing.overShared,
			JSON.stringify(report.recommendations), report.scannedAt,
		).run().catch(() => {});

		return c.json({ success: true, ...report });
	} catch (err) {
		console.error('Storage compliance scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});
