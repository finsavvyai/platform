/**
 * SCIM 2.0 User Provisioning Routes
 *
 * RFC 7644 — GET, POST, PUT, DELETE /scim/v2/Users
 * Auth: Bearer SCIM token (org-scoped)
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { SCIM_SCHEMAS } from '../services/scim/types.js';
import type { ScimUser, ScimListResponse, ScimError } from '../services/scim/types.js';
import { createScimUserSchema, updateScimUserSchema } from './validation/scim-users.js';

const scimUserRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// SCIM Bearer token auth — validates org-scoped SCIM token from KV
scimUserRoutes.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Missing Bearer token', status: '401' }, 401);
  }
  const token = authHeader.slice(7);
  const tokenData = await c.env.CACHE.get(`scim:token:${token}`);
  if (!tokenData) {
    return c.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Invalid SCIM token', status: '401' }, 401);
  }
  const { orgId } = JSON.parse(tokenData) as { orgId: string };
  c.set('orgId', orgId);
  await next();
});

function scimError(status: number, detail: string): ScimError {
  return { schemas: [SCIM_SCHEMAS.error], detail, status: String(status) };
}

function toScimUser(member: Record<string, unknown>): ScimUser {
  return {
    schemas: [SCIM_SCHEMAS.user],
    id: member.userId as string,
    userName: (member.email as string) ?? '',
    name: { givenName: (member.displayName as string) ?? '' },
    emails: member.email ? [{ value: member.email as string, primary: true }] : [],
    active: (member.status as string) !== 'removed',
    externalId: member.externalId as string | undefined,
    meta: {
      resourceType: 'User',
      created: member.createdAt as string,
      lastModified: member.updatedAt as string ?? member.createdAt as string,
    },
  };
}

/** GET /Users — List users with optional filter */
scimUserRoutes.get('/Users', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  const startIndex = Number(c.req.query('startIndex') ?? '1');
  const count = Math.min(Number(c.req.query('count') ?? '100'), 100);
  const filter = c.req.query('filter');

  let query = `SELECT * FROM org_members WHERE org_id = ?`;
  const params: unknown[] = [orgId];

  if (filter) {
    const match = filter.match(/userName\s+eq\s+"([^"]+)"/);
    if (match) {
      query += ` AND email = ?`;
      params.push(match[1]);
    }
  }

  query += ` LIMIT ? OFFSET ?`;
  params.push(count, startIndex - 1);

  // Safe: parameterized query via .bind()
  const result = await c.env.DB.prepare(query).bind(...params).all();
  // Safe: parameterized query via .bind()
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ?`,
  ).bind(orgId).first<{ cnt: number }>();

  const response: ScimListResponse<ScimUser> = {
    schemas: [SCIM_SCHEMAS.listResponse],
    totalResults: total?.cnt ?? 0,
    startIndex,
    itemsPerPage: count,
    Resources: (result.results ?? []).map(toScimUser),
  };

  return c.json(response);
});

/** GET /Users/:id — Get a single user */
scimUserRoutes.get('/Users/:id', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  // Safe: parameterized query via .bind()
  const member = await c.env.DB.prepare(
    `SELECT * FROM org_members WHERE org_id = ? AND user_id = ?`,
  ).bind(orgId, c.req.param('id')).first();

  if (!member) return c.json(scimError(404, 'User not found'), 404);
  return c.json(toScimUser(member as Record<string, unknown>));
});

/** POST /Users — Create/provision a user */
scimUserRoutes.post('/Users', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  const parsed = createScimUserSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(scimError(400, parsed.error.issues[0]?.message ?? 'Invalid input'), 400);
  const body = parsed.data as ScimUser;
  const email = body.emails?.[0]?.value ?? body.userName;
  if (!email) return c.json(scimError(400, 'userName or email required'), 400);

  const id = crypto.randomUUID();
  // Safe: parameterized query via .bind()
  await c.env.DB.prepare(
    `INSERT INTO org_members (id, org_id, user_id, email, role, status, external_id, created_at)
     VALUES (?, ?, ?, ?, 'viewer', 'active', ?, datetime('now'))`,
  ).bind(id, orgId, id, email, body.externalId ?? null).run();

  const user = toScimUser({ userId: id, email, status: 'active', externalId: body.externalId, createdAt: new Date().toISOString() });
  return c.json(user, 201);
});

/** PUT /Users/:id — Replace user */
scimUserRoutes.put('/Users/:id', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  const parsedUpdate = updateScimUserSchema.safeParse(await c.req.json());
  if (!parsedUpdate.success) return c.json(scimError(400, parsedUpdate.error.issues[0]?.message ?? 'Invalid input'), 400);
  const body = parsedUpdate.data as ScimUser;
  const status = body.active ? 'active' : 'removed';

  // Safe: parameterized query via .bind()
  await c.env.DB.prepare(
    `UPDATE org_members SET status = ?, updated_at = datetime('now') WHERE org_id = ? AND user_id = ?`,
  ).bind(status, orgId, c.req.param('id')).run();

  // Safe: parameterized query via .bind()
  const member = await c.env.DB.prepare(
    `SELECT * FROM org_members WHERE org_id = ? AND user_id = ?`,
  ).bind(orgId, c.req.param('id')).first();

  if (!member) return c.json(scimError(404, 'User not found'), 404);
  return c.json(toScimUser(member as Record<string, unknown>));
});

/** DELETE /Users/:id — Deactivate (soft-delete) user */
scimUserRoutes.delete('/Users/:id', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  // Safe: parameterized query via .bind()
  await c.env.DB.prepare(
    `UPDATE org_members SET status = 'removed', updated_at = datetime('now') WHERE org_id = ? AND user_id = ?`,
  ).bind(orgId, c.req.param('id')).run();

  return c.body(null, 204);
});

export { scimUserRoutes };
