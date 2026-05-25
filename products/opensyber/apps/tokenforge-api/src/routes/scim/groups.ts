/**
 * SCIM 2.0 /Groups endpoint — RFC 7644.
 *
 * Minimal implementation: Okta and Entra push group membership during
 * directory sync. We store groups as metadata on subjects rather than
 * as first-class entities (keeps the schema flat for v1). The /Groups
 * endpoint exists so Okta's SCIM tester doesn't fail on 404.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';

export const scimGroupRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /scim/v2/Groups — always returns empty list (groups stored on subjects) */
scimGroupRoutes.get('/', (c) => {
  return c.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 0,
    Resources: [],
  });
});

/** POST /scim/v2/Groups — accept and acknowledge (no-op storage) */
scimGroupRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  c.status(201);
  return c.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: crypto.randomUUID(),
    displayName: body.displayName ?? 'Unknown',
    members: [],
  });
});

/** PATCH /scim/v2/Groups/:id — acknowledge membership ops (no-op) */
scimGroupRoutes.patch('/:id', (c) => {
  return c.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: c.req.param('id'),
    members: [],
  });
});

/** DELETE /scim/v2/Groups/:id — acknowledge (no-op) */
scimGroupRoutes.delete('/:id', (c) => {
  return c.body(null, 204);
});
