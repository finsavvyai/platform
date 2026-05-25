/**
 * SCIM 2.0 Group endpoints. RFC 7644.
 *
 * Mounted at /scim/v2/Groups. Manages platform_groups + platform_group_members.
 * Member values are platform_users.id (UUID strings).
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { scimAuthMiddleware, requireScimScope } from '../../middleware/scim-auth';
import {
	serializeGroup,
	serializeList,
	scimError,
	SCIM_CONTENT_TYPE,
	type PlatformGroupRow,
} from '../../lib/scim/serializer';
import { parseFilter, parsePagination, filterAttrsAllowed, filterToSql } from '../../lib/scim/filter';

export const scimGroupsRoutes = new Hono<AppEnv>();
scimGroupsRoutes.use('*', scimAuthMiddleware);

const SCIM_HEADERS = { 'Content-Type': SCIM_CONTENT_TYPE };
const GROUP_COLUMNS = 'id, org_id, display_name, external_id, created_at, updated_at';

function baseUrl(c: { req: { url: string } }): string {
	const u = new URL(c.req.url);
	return `${u.origin}/scim/v2`;
}

async function loadMembers(
	db: D1Database,
	groupId: string,
): Promise<Array<{ id: string; email: string }>> {
	const r = await db
		.prepare(
			`SELECT u.id, u.email FROM platform_group_members m
			 JOIN platform_users u ON u.id = m.user_id
			 WHERE m.group_id = ? ORDER BY u.email`,
		)
		.bind(groupId).all<{ id: string; email: string }>();
	return r.results ?? [];
}

scimGroupsRoutes.get('/', requireScimScope('groups:read'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const { startIndex, count } = parsePagination(c.req.query());
	const rawFilter = c.req.query('filter');
	const filter = parseFilter(rawFilter);

	let where = 'org_id = ?';
	const binds: (string | number)[] = [orgId];
	if (rawFilter && !filter) {
		return c.json(scimError(400, `Unsupported filter: ${rawFilter}`, 'invalidFilter'), 400, SCIM_HEADERS);
	}
	if (filter) {
		if (!filterAttrsAllowed(filter, 'group')) {
			const bad = filter.type === 'simple' ? filter.attribute : filter.clauses.map(c => c.attribute).join(', ');
			return c.json(scimError(400, `Unsupported attribute(s): ${bad}`, 'invalidFilter'), 400, SCIM_HEADERS);
		}
		const groupColumnFor = (a: string): string => {
			if (a === 'displayName') return 'display_name';
			if (a === 'externalId') return 'external_id';
			return a === 'id' ? 'id' : a;
		};
		const sql = filterToSql(filter, groupColumnFor);
		where += ` AND (${sql.where})`;
		binds.push(...sql.params as (string | number)[]);
	}

	const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM platform_groups WHERE ${where}`)
		.bind(...binds).first<{ n: number }>();
	const total = totalRow?.n ?? 0;

	const rows = await c.env.DB.prepare(
		`SELECT ${GROUP_COLUMNS} FROM platform_groups WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
	).bind(...binds, count, startIndex - 1).all<PlatformGroupRow>();

	const resources = await Promise.all(
		(rows.results ?? []).map(async (g) => serializeGroup(g, baseUrl(c), await loadMembers(c.env.DB, g.id))),
	);
	return c.json(serializeList(resources, startIndex, count, total), 200, SCIM_HEADERS);
});

scimGroupsRoutes.get('/:id', requireScimScope('groups:read'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const row = await c.env.DB
		.prepare(`SELECT ${GROUP_COLUMNS} FROM platform_groups WHERE id = ? AND org_id = ?`)
		.bind(id, orgId).first<PlatformGroupRow>();
	if (!row) return c.json(scimError(404, 'Group not found'), 404, SCIM_HEADERS);
	const members = await loadMembers(c.env.DB, id);
	return c.json(serializeGroup(row, baseUrl(c), members), 200, SCIM_HEADERS);
});

scimGroupsRoutes.post('/', requireScimScope('groups:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
	if (!body || typeof body.displayName !== 'string') {
		return c.json(scimError(400, 'Missing displayName', 'invalidValue'), 400, SCIM_HEADERS);
	}
	const externalId = typeof body.externalId === 'string' ? body.externalId : null;
	const id = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	await c.env.DB
		.prepare(
			`INSERT INTO platform_groups (id, org_id, display_name, external_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		).bind(id, orgId, body.displayName, externalId, now, now).run();

	if (Array.isArray(body.members)) {
		const valid = (body.members as Array<{ value?: unknown }>)
			.map((m) => (typeof m?.value === 'string' ? m.value : null))
			.filter((v): v is string => Boolean(v));
		for (const userId of valid) {
			await c.env.DB
				.prepare('INSERT OR IGNORE INTO platform_group_members (group_id, user_id, added_at) VALUES (?, ?, ?)')
				.bind(id, userId, now).run().catch(() => {});
		}
	}

	const row: PlatformGroupRow = {
		id, org_id: orgId, display_name: body.displayName, external_id: externalId,
		created_at: now, updated_at: now,
	};
	const members = await loadMembers(c.env.DB, id);
	return c.json(serializeGroup(row, baseUrl(c), members), 201, SCIM_HEADERS);
});

scimGroupsRoutes.patch('/:id', requireScimScope('groups:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => null) as { Operations?: Array<{ op: string; path?: string; value?: unknown }> } | null;
	const ops = body?.Operations;
	if (!Array.isArray(ops) || ops.length === 0) {
		return c.json(scimError(400, 'Missing Operations array', 'invalidSyntax'), 400, SCIM_HEADERS);
	}

	const exists = await c.env.DB.prepare('SELECT id FROM platform_groups WHERE id = ? AND org_id = ?')
		.bind(id, orgId).first();
	if (!exists) return c.json(scimError(404, 'Group not found'), 404, SCIM_HEADERS);

	const now = Math.floor(Date.now() / 1000);
	for (const op of ops) {
		const opName = op.op?.toLowerCase();
		if (opName === 'replace' && op.path === 'displayName' && typeof op.value === 'string') {
			await c.env.DB.prepare('UPDATE platform_groups SET display_name = ?, updated_at = ? WHERE id = ?')
				.bind(op.value, now, id).run();
		} else if ((opName === 'add' || opName === 'replace') && op.path === 'members' && Array.isArray(op.value)) {
			if (opName === 'replace') {
				await c.env.DB.prepare('DELETE FROM platform_group_members WHERE group_id = ?').bind(id).run();
			}
			for (const m of op.value as Array<{ value?: unknown }>) {
				if (typeof m?.value === 'string') {
					await c.env.DB.prepare('INSERT OR IGNORE INTO platform_group_members (group_id, user_id, added_at) VALUES (?, ?, ?)')
						.bind(id, m.value, now).run().catch(() => {});
				}
			}
		} else if (opName === 'remove' && typeof op.path === 'string' && op.path.startsWith('members[value eq')) {
			const m = /value eq "([^"]+)"/.exec(op.path);
			if (m) {
				await c.env.DB.prepare('DELETE FROM platform_group_members WHERE group_id = ? AND user_id = ?')
					.bind(id, m[1]).run();
			}
		}
	}

	const row = await c.env.DB
		.prepare(`SELECT ${GROUP_COLUMNS} FROM platform_groups WHERE id = ?`)
		.bind(id).first<PlatformGroupRow>();
	const members = await loadMembers(c.env.DB, id);
	return c.json(serializeGroup(row!, baseUrl(c), members), 200, SCIM_HEADERS);
});

scimGroupsRoutes.delete('/:id', requireScimScope('groups:write'), async (c) => {
	const orgId = c.get('scimOrgId')!;
	const id = c.req.param('id');
	const result = await c.env.DB
		.prepare('DELETE FROM platform_groups WHERE id = ? AND org_id = ?')
		.bind(id, orgId).run();
	if (!result.meta.changes) return c.json(scimError(404, 'Group not found'), 404, SCIM_HEADERS);
	await c.env.DB.prepare('DELETE FROM platform_group_members WHERE group_id = ?').bind(id).run().catch(() => {});
	return new Response(null, { status: 204 });
});
