/**
 * Inbox Rule Audit Routes
 * Audits mailbox rules per user via Graph
 * /v1.0/users/{id}/mailFolders/inbox/messageRules.
 *
 * Surfaces forwarding/redirect/delete rules — primary BEC indicator.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { auditUserInboxRules, summarize, type InboxRule, type RuleFinding } from '../../lib/email/inbox-rule-auditor';

export const inboxRuleRoutes = new Hono<AppEnv>();

interface CachedUser { id: string; user_principal_name?: string | null; mail?: string | null; account_enabled?: number | boolean | null }

async function loadInternalDomains(env: AppEnv['Bindings'], azureTenantId: string): Promise<Set<string>> {
	try {
		const { GraphClient } = await import('../../lib/graph-client');
		const graph = new GraphClient(env as any, azureTenantId);
		const org = await graph.fetch('/organization');
		const verified = (org?.value?.[0]?.verifiedDomains ?? []) as Array<{ name?: string }>;
		const set = new Set<string>();
		for (const d of verified) if (d.name) set.add(d.name.toLowerCase());
		return set;
	} catch {
		return new Set();
	}
}

async function fetchUserRules(env: AppEnv['Bindings'], azureTenantId: string, userId: string): Promise<InboxRule[]> {
	const { GraphClient } = await import('../../lib/graph-client');
	const graph = new GraphClient(env as any, azureTenantId);
	const res = await graph.fetch(`/v1.0/users/${userId}/mailFolders/inbox/messageRules`);
	const value = res?.value;
	return Array.isArray(value) ? (value as InboxRule[]) : [];
}

// GET /api/tenants/:id/inbox-rules — Audit all enabled users' inbox rules.
// Query params: limit (default 50, max 200), offset (default 0).
inboxRuleRoutes.get('/:id/inbox-rules', async (c) => {
	const tenantDbId = c.req.param('id');
	const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50));
	const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);

	const tenant = await c.env.DB
		.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantDbId)
		.first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not found' }, 404);

	const users = await c.env.DB
		.prepare(
			'SELECT azure_user_id AS id, user_principal_name, mail, account_enabled FROM users_cache WHERE tenant_id = ? AND account_enabled = 1 ORDER BY user_principal_name LIMIT ? OFFSET ?',
		)
		.bind(tenantDbId, limit, offset)
		.all()
		.catch(() => ({ results: [] as CachedUser[] }));

	const userRows = (users.results ?? []) as CachedUser[];
	if (userRows.length === 0) {
		return c.json({
			summary: summarize([], 0, 0, 0),
			findings: [],
			pagination: { limit, offset, returned: 0 },
			message: 'No users in cache. Sync the tenant first.',
		});
	}

	const internalDomains = await loadInternalDomains(c.env, tenant.azure_tenant_id);

	const findings: RuleFinding[] = [];
	let usersWithRules = 0;
	let totalRules = 0;

	for (const u of userRows) {
		try {
			const rules = await fetchUserRules(c.env, tenant.azure_tenant_id, u.id);
			if (rules.length > 0) usersWithRules++;
			totalRules += rules.length;
			findings.push(...auditUserInboxRules(u.id, u.user_principal_name ?? u.mail ?? undefined, rules, internalDomains));
		} catch (err) {
			console.warn('[inbox-rules] failed to fetch rules for user', u.id, err instanceof Error ? err.message : err);
		}
	}

	return c.json({
		summary: summarize(findings, userRows.length, usersWithRules, totalRules),
		findings: findings.sort((a, b) => {
			const ord = { critical: 0, high: 1, medium: 2, low: 3 } as const;
			return ord[a.severity] - ord[b.severity];
		}),
		pagination: { limit, offset, returned: userRows.length },
	});
});
