/**
 * Tenant security routes: users, security status, certificates, policies,
 * privileged users, admin roles.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { kvCache } from '../../middleware/cache';

export const securityGraphRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/users
securityGraphRoutes.get('/:id/users', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT id, azure_user_id, display_name, mail, user_principal_name, job_title, department, account_enabled, last_sign_in_at FROM users_cache WHERE tenant_id = ? LIMIT 100')
		.bind(id)
		.all().catch(() => ({ results: [] }));
	return c.json({ users: result.results, total: result.results.length });
});

// GET /api/tenants/:id/security — Session Security dashboard data
securityGraphRoutes.get('/:id/security', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;

	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();

	// User counts from cached sync.
	const userStats = await db.prepare(
		'SELECT COUNT(*) as total, SUM(CASE WHEN account_enabled = 1 THEN 1 ELSE 0 END) as enabled FROM users_cache WHERE tenant_id = ?',
	).bind(id).first<{ total: number; enabled: number }>().catch(() => ({ total: 0, enabled: 0 }));

	const totalUsers = Number(userStats?.total ?? 0);
	const enabledUsers = Number(userStats?.enabled ?? 0);

	// MFA + Conditional Access from Graph if we have an azure tenant.
	let mfaEnrolled = 0;
	let caPolicies = 0;
	let tokenLifetimePolicies = false;
	let sessionRevocationEnabled = false;
	let signInRiskPolicy = false;
	let riskySignins: unknown[] = [];

	if (tenant?.azure_tenant_id) {
		try {
			const { GraphClient } = await import('../../lib/graph-client');
			const { getMfaRegistrationDetails } = await import('../../lib/graph-client-extended');
			const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
			const [mfa, caRes] = await Promise.all([
				getMfaRegistrationDetails(graph).catch(() => []),
				graph.fetch('/identity/conditionalAccess/policies').catch(() => ({ value: [] })),
			]);
			mfaEnrolled = (mfa as any[]).filter((u: any) => u.isMfaRegistered || u.isMfaCapable).length;
			const enabledCA = ((caRes as any).value || []).filter((p: any) => p.state === 'enabled');
			caPolicies = enabledCA.length;
			signInRiskPolicy = enabledCA.some((p: any) => JSON.stringify(p.conditions?.signInRiskLevels ?? []).includes('medium'));
			tokenLifetimePolicies = caPolicies > 0;
			sessionRevocationEnabled = enabledCA.some((p: any) => JSON.stringify(p.sessionControls ?? {}).length > 2);
		} catch (err) {
			console.error('[security] Graph fetch failed:', err);
		}
	}

	const coveragePct = totalUsers > 0 ? Math.round((mfaEnrolled / totalUsers) * 100) : 0;
	return c.json({
		mfaCoverage: { enrolled: mfaEnrolled, total: totalUsers, percentage: coveragePct },
		activeSessions: enabledUsers,
		conditionalAccessPolicies: caPolicies,
		tokenLifetimePolicies,
		sessionRevocationEnabled,
		signInRiskPolicy,
		riskySignins,
	});
});

// GET /api/tenants/:id/certificates — Scan app registration secrets/certs
securityGraphRoutes.get('/:id/certificates', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ certificates: [] });

	try {
		const { GraphClient } = await import('../../lib/graph-client');
		const { getAppRegistrations } = await import('../../lib/graph-client-extended');
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const apps = await getAppRegistrations(graph);
		const now = new Date();
		const certs: any[] = [];
		for (const app of apps) {
			for (const cred of [...(app.passwordCredentials ?? []), ...(app.keyCredentials ?? [])]) {
				const expiry = cred.endDateTime ? new Date(cred.endDateTime) : null;
				const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;
				certs.push({
					appId: app.id, appName: app.displayName,
					type: cred.type === 'AsymmetricX509Cert' ? 'certificate' : 'secret',
					hint: cred.hint || cred.displayName || '',
					expiresAt: cred.endDateTime, daysUntilExpiry,
					status: daysUntilExpiry === null ? 'unknown' : daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry < 30 ? 'expiring_soon' : 'valid',
				});
			}
		}
		certs.sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));
		return c.json({ certificates: certs });
	} catch {
		return c.json({ certificates: [] });
	}
});

// GET /api/tenants/:id/policies — Real policy data (cached 300s)
securityGraphRoutes.get('/:id/policies', kvCache({ ttl: 300, prefix: 'policies' }), async (c) => {
	const id = c.req.param('id');
	const cached = await c.env.KV.get(`policies:${id}`, 'json') as { policies: unknown[]; summary: unknown } | null;
	if (cached) return c.json(cached);
	return c.json({ policies: [], summary: { total: 0, compliant: 0, partial: 0, nonCompliant: 0, missing: 0, complianceScore: 0 } });
});

// GET /api/tenants/:id/privileged-users — Admin roles + MFA from Graph
securityGraphRoutes.get('/:id/privileged-users', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ privilegedUsers: [], risks: [], totalAdmins: 0, adminsWithoutMfa: 0 });

	try {
		const { GraphClient } = await import('../../lib/graph-client');
		const { getDirectoryRoles, getMfaRegistrationDetails } = await import('../../lib/graph-client-extended');
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const [roles, mfaDetails] = await Promise.all([getDirectoryRoles(graph), getMfaRegistrationDetails(graph)]);
		const mfaByUpn = new Map(mfaDetails.map((m: any) => [m.userPrincipalName, m.isMfaRegistered]));
		const adminRoles = roles.filter((r: any) => r.displayName?.includes('Admin') || r.displayName?.includes('Global'));
		const admins = new Map<string, any>();
		for (const role of adminRoles) {
			for (const m of role.members ?? []) {
				if (!admins.has(m.id)) {
					admins.set(m.id, { ...m, roles: [role.displayName], mfaRegistered: mfaByUpn.get(m.userPrincipalName) ?? false });
				} else {
					admins.get(m.id)!.roles.push(role.displayName);
				}
			}
		}
		const privilegedUsers = Array.from(admins.values());
		const adminsWithoutMfa = privilegedUsers.filter(a => !a.mfaRegistered).length;
		const risks = adminsWithoutMfa > 0 ? [{ type: 'mfa_gap', message: `${adminsWithoutMfa} admin(s) without MFA`, severity: 'high' }] : [];
		return c.json({ privilegedUsers, risks, totalAdmins: privilegedUsers.length, adminsWithoutMfa });
	} catch {
		const users = await c.env.DB.prepare('SELECT * FROM users_cache WHERE tenant_id = ? AND account_enabled = 1').bind(id).all().catch(() => ({ results: [] }));
		return c.json({ privilegedUsers: users.results, risks: [], totalAdmins: users.results.length, adminsWithoutMfa: 0 });
	}
});

// GET /api/tenants/:id/admin-roles — Real role data from Graph API
securityGraphRoutes.get('/:id/admin-roles', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ roles: [], changes: [] });

	try {
		const { GraphClient } = await import('../../lib/graph-client');
		const { getDirectoryRoles } = await import('../../lib/graph-client-extended');
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const dirRoles = await getDirectoryRoles(graph);
		const roles = dirRoles.map((r: any) => ({
			id: r.id, displayName: r.displayName, description: r.description,
			memberCount: r.members?.length ?? 0,
			members: (r.members ?? []).map((m: any) => ({
				id: m.id, displayName: m.displayName, userPrincipalName: m.userPrincipalName,
			})),
		}));
		return c.json({ roles, changes: [] });
	} catch {
		return c.json({ roles: [], changes: [] });
	}
});
