/**
 * SCIM 2.0 Group Provisioning Routes
 *
 * RFC 7644 — GET /scim/v2/Groups
 * Maps SCIM groups to RBAC roles (admin, security, developer, viewer)
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { SCIM_SCHEMAS } from '../services/scim/types.js';
import type { ScimGroup, ScimListResponse, ScimError } from '../services/scim/types.js';

const scimGroupRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// SCIM Bearer token auth — validates org-scoped SCIM token from KV
scimGroupRoutes.use('*', async (c, next) => {
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

const ROLE_GROUPS: ScimGroup[] = [
  { schemas: [SCIM_SCHEMAS.group], id: 'admin', displayName: 'Admin' },
  { schemas: [SCIM_SCHEMAS.group], id: 'security', displayName: 'Security' },
  { schemas: [SCIM_SCHEMAS.group], id: 'developer', displayName: 'Developer' },
  { schemas: [SCIM_SCHEMAS.group], id: 'viewer', displayName: 'Viewer' },
];

function scimError(status: number, detail: string): ScimError {
  return { schemas: [SCIM_SCHEMAS.error], detail, status: String(status) };
}

/** GET /Groups — List available role-based groups */
scimGroupRoutes.get('/Groups', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  // Safe: parameterized query via .bind()
  const members = await c.env.DB.prepare(
    `SELECT user_id, role, email FROM org_members WHERE org_id = ? AND status = 'active'`,
  ).bind(orgId).all();

  const groups = ROLE_GROUPS.map((g) => ({
    ...g,
    members: (members.results ?? [])
      .filter((m) => (m as Record<string, unknown>).role === g.id)
      .map((m) => ({
        value: (m as Record<string, unknown>).user_id as string,
        display: (m as Record<string, unknown>).email as string,
      })),
    meta: { resourceType: 'Group', created: '2026-01-01T00:00:00Z', lastModified: '2026-01-01T00:00:00Z' },
  }));

  const response: ScimListResponse<ScimGroup> = {
    schemas: [SCIM_SCHEMAS.listResponse],
    totalResults: groups.length,
    startIndex: 1,
    itemsPerPage: groups.length,
    Resources: groups,
  };

  return c.json(response);
});

/** GET /Groups/:id — Get a single group */
scimGroupRoutes.get('/Groups/:id', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json(scimError(400, 'Org context required'), 400);

  const group = ROLE_GROUPS.find((g) => g.id === c.req.param('id'));
  if (!group) return c.json(scimError(404, 'Group not found'), 404);

  // Safe: parameterized query via .bind()
  const members = await c.env.DB.prepare(
    `SELECT user_id, email FROM org_members WHERE org_id = ? AND role = ? AND status = 'active'`,
  ).bind(orgId, group.id).all();

  return c.json({
    ...group,
    members: (members.results ?? []).map((m) => ({
      value: (m as Record<string, unknown>).user_id as string,
      display: (m as Record<string, unknown>).email as string,
    })),
    meta: { resourceType: 'Group', created: '2026-01-01T00:00:00Z', lastModified: '2026-01-01T00:00:00Z' },
  });
});

export { scimGroupRoutes };
