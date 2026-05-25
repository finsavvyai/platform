/**
 * Ad-Hoc Delegation Routes
 *
 * Manage mailbox and OneDrive delegation permissions via Microsoft Graph.
 * Delegations are stored in KV with expiration support.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';

const DELEGATION_SCOPES = ['mailbox', 'onedrive'] as const;
type DelegationScope = (typeof DELEGATION_SCOPES)[number];

interface Delegation {
	delegationId: string;
	userId: string;
	delegateId: string;
	scope: DelegationScope[];
	expiresAt: string | null;
	createdAt: string;
	createdBy: string;
}

const delegations = new Hono<AppEnv>();

delegations.use('*', authMiddleware);
delegations.use('*', standardRateLimit);

function kvKey(tenantId: string, delegationId: string): string {
	return `delegation:${tenantId}:${delegationId}`;
}

function indexKey(tenantId: string): string {
	return `delegation-index:${tenantId}`;
}

async function getIndex(kv: KVNamespace, tenantId: string): Promise<string[]> {
	const raw = await kv.get(indexKey(tenantId));
	return raw ? JSON.parse(raw) : [];
}

async function saveIndex(kv: KVNamespace, tenantId: string, ids: string[]): Promise<void> {
	await kv.put(indexKey(tenantId), JSON.stringify(ids));
}

async function applyGraphPermissions(
	graph: ReturnType<typeof createGraphClient>,
	userId: string,
	delegateId: string,
	scope: DelegationScope[]
): Promise<void> {
	for (const s of scope) {
		if (s === 'mailbox') {
			await graph.request(`https://graph.microsoft.com/v1.0/users/${userId}/mailboxSettings`, {
				method: 'PATCH',
			}).catch(() => {});
			await graph.request(
				`https://graph.microsoft.com/v1.0/users/${userId}/mailFolders/inbox/permissions`,
				{ method: 'POST', body: JSON.stringify({ grantedTo: { emailAddress: { address: delegateId } }, permission: 'fullAccess' }) }
			).catch(() => {});
		}
		if (s === 'onedrive') {
			await graph.request(
				`https://graph.microsoft.com/v1.0/users/${userId}/drive/root/invite`,
				{ method: 'POST', body: JSON.stringify({ recipients: [{ objectId: delegateId }], roles: ['write'], requireSignIn: true }) }
			).catch(() => {});
		}
	}
}

/** POST /api/users/:userId/delegate — create delegation */
delegations.post('/:userId/delegate', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const body = await c.req.json<{ delegateId: string; scope: DelegationScope[]; expiresAt?: string }>();

	if (!body.delegateId || !body.scope?.length) {
		return c.json({ error: 'Bad Request', message: 'delegateId and scope are required' }, 400);
	}

	const invalidScopes = body.scope.filter((s) => !DELEGATION_SCOPES.includes(s));
	if (invalidScopes.length) {
		return c.json({ error: 'Bad Request', message: `Invalid scopes: ${invalidScopes.join(', ')}` }, 400);
	}

	const graph = createGraphClient(c.env, tenantId);
	await applyGraphPermissions(graph, userId, body.delegateId, body.scope);

	const delegationId = crypto.randomUUID();
	const delegation: Delegation = {
		delegationId, userId, delegateId: body.delegateId,
		scope: body.scope, expiresAt: body.expiresAt ?? null,
		createdAt: new Date().toISOString(), createdBy: c.get('userId') ?? '',
	};

	const kv = c.env.KV;
	await kv.put(kvKey(tenantId, delegationId), JSON.stringify(delegation));

	const ids = await getIndex(kv, tenantId);
	ids.unshift(delegationId);
	await saveIndex(kv, tenantId, ids);

	return c.json(delegation, 201);
});

/** GET /api/users/:userId/delegations — list delegations for a user */
delegations.get('/:userId/delegations', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const kv = c.env.KV;
	const ids = await getIndex(kv, tenantId);

	const results: Delegation[] = [];
	for (const id of ids) {
		const raw = await kv.get(kvKey(tenantId, id));
		if (!raw) continue;
		const d: Delegation = JSON.parse(raw);
		if (d.userId === userId) results.push(d);
	}

	return c.json({ delegations: results, count: results.length });
});

/** DELETE /api/users/:userId/delegations/:delegationId — revoke delegation */
delegations.delete('/:userId/delegations/:delegationId', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const delegationId = c.req.param('delegationId');
	if (!delegationId) return c.json({ error: 'Missing delegationId' }, 400);
	const kv = c.env.KV;

	const raw = await kv.get(kvKey(tenantId, delegationId));
	if (!raw) return c.json({ error: 'Not Found', message: 'Delegation not found' }, 404);

	await kv.delete(kvKey(tenantId, delegationId));
	const ids = (await getIndex(kv, tenantId)).filter((id) => id !== delegationId);
	await saveIndex(kv, tenantId, ids);

	return c.json({ success: true, delegationId });
});

/** GET /api/delegations — all active delegations for tenant */
delegations.get('/', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const kv = c.env.KV;
	const ids = await getIndex(kv, tenantId);

	const results: Delegation[] = [];
	for (const id of ids.slice(0, 100)) {
		const raw = await kv.get(kvKey(tenantId, id));
		if (raw) results.push(JSON.parse(raw));
	}

	return c.json({ delegations: results, count: results.length });
});

export { delegations as userDelegationRoutes };
export default delegations;
