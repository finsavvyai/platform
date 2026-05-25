/**
 * Account-level endpoints. GDPR Art. 17 / M365 Cert C7 right-to-erasure.
 * Mounts on /api/account.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { deleteOrganization } from '../lib/account-deletion';
import { writeAuditLog } from '../lib/audit-logger';
import { clearSessionCookieValue } from './auth-session';

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.use('*', authMiddleware);

accountRoutes.delete(
	'/',
	rateLimitMiddleware({ limit: 2, windowSeconds: 600, keyPrefix: 'account-delete' }),
	requireRole('admin', 'super_admin'),
	async (c) => {
		const user = c.get('user');
		const orgId = user.orgId;
		if (!orgId) return c.json({ error: 'No organization on session' }, 400);

		const body = await c.req.json<{ confirm?: string }>().catch(() => ({} as any));
		if (body.confirm !== 'DELETE') {
			return c.json(
				{ error: 'Provide { "confirm": "DELETE" } to proceed. Action is irreversible.' },
				400,
			);
		}

		writeAuditLog(c, {
			tenantId: orgId,
			eventType: 'account.delete.requested',
			actorId: user.sub,
			actorType: 'user',
			action: 'delete_organization',
			result: 'success',
			details: { email: user.email },
			complianceCategory: 'data-deletion',
		}).catch(() => {});

		const report = await deleteOrganization(c, orgId);

		console.log('[account.delete]', JSON.stringify(report));

		c.header('Set-Cookie', clearSessionCookieValue(c));
		return c.json({ ok: true, report });
	},
);

accountRoutes.get('/export', async (c) => {
	const user = c.get('user');
	const orgId = user.orgId;
	if (!orgId) return c.json({ error: 'No organization on session' }, 400);

	const db = c.env.DB;
	const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').bind(orgId).first();
	const users = await db
		.prepare('SELECT id, email, name, role, status, created_at FROM platform_users WHERE organization_id = ?')
		.bind(orgId)
		.all();
	const tenants = await db
		.prepare('SELECT id, azure_tenant_id, display_name, domain, status, created_at FROM tenants WHERE organization_id = ?')
		.bind(orgId)
		.all();

	writeAuditLog(c, {
		tenantId: orgId,
		eventType: 'account.export',
		actorId: user.sub,
		actorType: 'user',
		action: 'export_organization',
		result: 'success',
		complianceCategory: 'data-portability',
	}).catch(() => {});

	return c.json({
		generatedAt: new Date().toISOString(),
		organization: org,
		platformUsers: users.results,
		tenants: tenants.results,
		note: 'For tenant-scoped data (alerts, scans, snapshots) request a full export via support@tenantiq.app — multi-GB exports are R2-streamed, not inline.',
	});
});
