/**
 * Copilot Security Posture / Prompt Guard Routes
 *
 * POST /api/copilot-security/scan — Run Copilot security analysis
 * GET /api/copilot-security/posture — Get latest posture result
 * POST /api/copilot-security/analyze-prompt — Check a single prompt for injection
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import { GraphClient } from '../lib/graph-client';
import {
	buildCopilotSecurityPosture,
	detectPromptInjection,
	type CopilotAuditEntry,
} from '../lib/copilot-prompt-guard';

export const copilotSecurityRoutes = new Hono<AppEnv>();
copilotSecurityRoutes.use('*', authMiddleware);

copilotSecurityRoutes.post('/scan', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);

		const [auditLogs, dlpPolicies, labels, caPolicies] = await Promise.all([
			graph.fetch('/auditLogs/signIns?$filter=appDisplayName eq \'Microsoft 365 Copilot\'&$top=100')
				.catch(() => ({ value: [] })),
			graph.fetch('/informationProtection/policy/labels').catch(() => ({ value: [] })),
			graph.fetch('/informationProtection/policy/labels').catch(() => ({ value: [] })),
			graph.fetch('/identity/conditionalAccess/policies').catch(() => ({ value: [] })),
		]);

		const entries: CopilotAuditEntry[] = ((auditLogs as any).value || []).map((log: any) => ({
			userId: log.userId || '',
			userDisplayName: log.userDisplayName || '',
			timestamp: log.createdDateTime || '',
			operation: log.operationType || 'signIn',
			application: 'Microsoft 365 Copilot',
			accessedResources: [],
		}));

		const hasDlp = ((dlpPolicies as any).value || []).length > 0;
		const hasLabels = ((labels as any).value || []).length >= 3;
		const hasCa = ((caPolicies as any).value || []).filter((p: any) => p.state === 'enabled').length > 0;

		const posture = buildCopilotSecurityPosture(entries, hasDlp, hasLabels, hasCa, true);

		await c.env.KV.put(`copilot-security:${tenantId}:latest`, JSON.stringify(posture), { expirationTtl: 7200 });
		return c.json({ success: true, posture });
	} catch (err) {
		console.error('Copilot security scan failed:', err);
		return c.json({ error: 'Scan failed' }, 500);
	}
});

copilotSecurityRoutes.get('/posture', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`copilot-security:${tenantId}:latest`, 'json');
	if (cached) return c.json(cached);
	return c.json({ overallScore: null, message: 'No scan yet. Run POST /scan to start.' });
});

copilotSecurityRoutes.post('/analyze-prompt', async (c) => {
	const body = await c.req.json<{ prompt: string; userId?: string }>();
	if (!body.prompt) return c.json({ error: 'prompt required' }, 400);

	const entry: CopilotAuditEntry = {
		userId: body.userId || 'manual-check',
		userDisplayName: 'Manual Check',
		timestamp: new Date().toISOString(),
		operation: 'prompt-analysis',
		application: 'Manual',
		promptText: body.prompt,
		accessedResources: [],
	};

	const finding = detectPromptInjection(entry);
	return c.json({
		safe: finding === null,
		finding,
	});
});
