/**
 * Entra ID Federated Identity Audit Routes
 *
 * POST /api/federated-identity/audit — Run federated identity credential audit
 * GET /api/federated-identity/latest — Get latest audit result
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { getSelectedTenant } from '../lib/tenant-selector';
import {
	evaluateFederatedCredentials,
	buildAuditResult,
	type FederatedCredential,
} from '../lib/cis/federated-identity-auditor';

export const federatedIdentityRoutes = new Hono<AppEnv>();
federatedIdentityRoutes.use('*', authMiddleware);

federatedIdentityRoutes.post('/audit', async (c) => {
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
		const apps = await graph.fetch('/applications?$select=id,displayName');
		const appList = (apps as any).value || [];

		const credentials: FederatedCredential[] = [];
		for (const app of appList) {
			const fedCreds = await graph.fetch(
				`/applications/${app.id}/federatedIdentityCredentials`
			).catch(() => ({ value: [] }));
			for (const cred of ((fedCreds as any).value || [])) {
				credentials.push({
					appId: app.id,
					appDisplayName: app.displayName,
					credentialId: cred.id,
					issuer: cred.issuer || '',
					subject: cred.subject || '',
					audiences: cred.audiences || [],
					description: cred.description || '',
				});
			}
		}

		const roleAssignments = await graph.fetch(
			'/roleManagement/directory/roleAssignments?$filter=roleDefinitionId eq \'owner\' or roleDefinitionId eq \'contributor\''
		).catch(() => ({ value: [] }));
		const privilegedIds = new Set<string>(
			((roleAssignments as any).value || []).map((r: any) => r.principalId)
		);

		const findings = evaluateFederatedCredentials(credentials, privilegedIds);
		const result = buildAuditResult(appList.length, credentials, findings);

		await c.env.KV.put(`federated:${tenantId}:latest`, JSON.stringify(result), { expirationTtl: 7200 });
		return c.json({ success: true, result });
	} catch (err) {
		console.error('Federated identity audit failed:', err);
		return c.json({ error: 'Audit failed' }, 500);
	}
});

federatedIdentityRoutes.get('/latest', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const cached = await c.env.KV.get(`federated:${tenantId}:latest`, 'json');
	if (cached) return c.json(cached);
	return c.json({ score: null, message: 'No audit yet. Run POST /audit to start.' });
});
