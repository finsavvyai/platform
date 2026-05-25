/**
 * SCIM 2.0 User endpoints. RFC 7644.
 *
 * Mounted at /scim/v2/Users. Protected by scim-auth middleware (Bearer token,
 * org-scoped via c.get('scimOrgId')).
 *
 * Target table: platform_users (MSP team members), NOT M365 users_cache.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { scimAuthMiddleware, requireScimScope } from '../../middleware/scim-auth';
import {
	serializeUser,
	serializeList,
	scimError,
	SCIM_CONTENT_TYPE,
	type PlatformUserRow,
} from '../../lib/scim/serializer';
import { parseFilter, parsePagination, filterAttrsAllowed, filterToSql } from '../../lib/scim/filter';

export const scimUsersRoutes = new Hono<AppEnv>();
scimUsersRoutes.use('*', scimAuthMiddleware);

const SCIM_HEADERS = { 'Content-Type': SCIM_CONTENT_TYPE };

function baseUrl(c: { req: { url: string } }): string {
	const u = new URL(c.req.url);
	return `${u.origin}/scim/v2`;
}

const USER_COLUMNS =
	'id, organization_id, email, display_name, role, status, last_login_at, created_at';

scimUsersRoutes.get('/', requireScimScope('users:read'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const { startIndex, count } = parsePagination(c.req.query());
	const rawFilter = c.req.query('filter');
	const filter = parseFilter(rawFilter);

	let where = 'organization_id = ?';
	const binds: (string | number)[] = [orgId];

	if (rawFilter && !filter) {
		return c.json(scimError(400, `Unsupported filter: ${rawFilter}`, 'invalidFilter'), 400, SCIM_HEADERS);
	}
	if (filter) {
		if (!filterAttrsAllowed(filter, 'user')) {
			const bad = filter.type === 'simple' ? filter.attribute : filter.clauses.map(c => c.attribute).join(', ');
			return c.json(scimError(400, `Unsupported attribute(s): ${bad}`, 'invalidFilter'), 400, SCIM_HEADERS);
		}
		const userColumnFor = (a: string): string => {
			if (a === 'userName' || a === 'emails.value') return 'email';
			if (a === 'externalId') return 'id';
			if (a === 'name.givenName') return 'first_name';
			if (a === 'name.familyName') return 'last_name';
			return a;
		};
		const sql = filterToSql(filter, userColumnFor);
		where += ` AND (${sql.where})`;
		binds.push(...sql.params as (string | number)[]);
	}

	const totalRow = await c.env.DB
		.prepare(`SELECT COUNT(*) as n FROM platform_users WHERE ${where}`)
		.bind(...binds).first<{ n: number }>();
	const total = totalRow?.n ?? 0;

	const rows = await c.env.DB
		.prepare(`SELECT ${USER_COLUMNS} FROM platform_users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
		.bind(...binds, count, startIndex - 1).all<PlatformUserRow>();

	const resources = (rows.results ?? []).map((r) => serializeUser(r, baseUrl(c)));
	return c.json(serializeList(resources, startIndex, count, total), 200, SCIM_HEADERS);
});

scimUsersRoutes.get('/:id', requireScimScope('users:read'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const row = await c.env.DB
		.prepare(`SELECT ${USER_COLUMNS} FROM platform_users WHERE id = ? AND organization_id = ?`)
		.bind(id, orgId).first<PlatformUserRow>();
	if (!row) return c.json(scimError(404, 'User not found'), 404, SCIM_HEADERS);
	return c.json(serializeUser(row, baseUrl(c)), 200, SCIM_HEADERS);
});

scimUsersRoutes.post('/', requireScimScope('users:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
	if (!body || typeof body.userName !== 'string') {
		return c.json(scimError(400, 'Missing userName', 'invalidValue'), 400, SCIM_HEADERS);
	}
	const userName = body.userName.trim().toLowerCase();
	const displayName = typeof body.displayName === 'string' ? body.displayName : null;
	const active = body.active !== false;

	const existing = await c.env.DB
		.prepare('SELECT id FROM platform_users WHERE email = ?')
		.bind(userName).first<{ id: string }>();
	if (existing) return c.json(scimError(409, 'User already exists', 'uniqueness'), 409, SCIM_HEADERS);

	const id = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	await c.env.DB
		.prepare(
			`INSERT INTO platform_users (id, organization_id, email, display_name, role, status, created_at)
			 VALUES (?, ?, ?, ?, 'member', ?, ?)`,
		)
		.bind(id, orgId, userName, displayName, active ? 'active' : 'inactive', now).run();

	const row: PlatformUserRow = {
		id, organization_id: orgId, email: userName, display_name: displayName,
		role: 'member', status: active ? 'active' : 'inactive',
		last_login_at: null, created_at: now,
	};
	return c.json(serializeUser(row, baseUrl(c)), 201, SCIM_HEADERS);
});

scimUsersRoutes.patch('/:id', requireScimScope('users:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => null) as { Operations?: Array<{ op: string; path?: string; value?: unknown }> } | null;
	const ops = body?.Operations;
	if (!Array.isArray(ops) || ops.length === 0) {
		return c.json(scimError(400, 'Missing Operations array', 'invalidSyntax'), 400, SCIM_HEADERS);
	}

	const sets: string[] = [];
	const binds: (string | number | null)[] = [];
	for (const op of ops) {
		if (op.op?.toLowerCase() !== 'replace' || !op.path) continue;
		if (op.path === 'active') {
			sets.push('status = ?');
			binds.push(op.value === false ? 'inactive' : 'active');
		} else if (op.path === 'displayName' && typeof op.value === 'string') {
			sets.push('display_name = ?');
			binds.push(op.value);
		}
	}
	if (sets.length === 0) {
		return c.json(scimError(400, 'No supported operations', 'invalidPath'), 400, SCIM_HEADERS);
	}

	binds.push(id, orgId);
	await c.env.DB
		.prepare(`UPDATE platform_users SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`)
		.bind(...binds).run();

	const row = await c.env.DB
		.prepare(`SELECT ${USER_COLUMNS} FROM platform_users WHERE id = ? AND organization_id = ?`)
		.bind(id, orgId).first<PlatformUserRow>();
	if (!row) return c.json(scimError(404, 'User not found'), 404, SCIM_HEADERS);
	return c.json(serializeUser(row, baseUrl(c)), 200, SCIM_HEADERS);
});

scimUsersRoutes.delete('/:id', requireScimScope('users:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const result = await c.env.DB
		.prepare("UPDATE platform_users SET status = 'inactive' WHERE id = ? AND organization_id = ?")
		.bind(id, orgId).run();
	if (!result.meta.changes) return c.json(scimError(404, 'User not found'), 404, SCIM_HEADERS);
	return new Response(null, { status: 204 });
});
