/**
 * SCIM 2.0 /Users endpoint — RFC 7644.
 *
 * Provisions workforce subjects from IdP directory sync (Okta, Entra).
 * Subjects created via SCIM are identical to those created via SSO
 * exchange — same tf_subjects table. SCIM just adds the ability to
 * pre-provision users before they log in and to deactivate them when
 * offboarded in the IdP.
 *
 * Auth: Bearer token = tenant API key (same as /v1/* routes).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { tfSubjects } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';

const SCIM_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';

const createSchema = z.object({
  schemas: z.array(z.string()),
  userName: z.string().min(1),
  name: z.object({ formatted: z.string().optional() }).optional(),
  emails: z.array(z.object({ value: z.string().email(), primary: z.boolean().optional() })).optional(),
  externalId: z.string().optional(),
  active: z.boolean().optional(),
});

export const scimUserRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /scim/v2/Users — list provisioned subjects */
scimUserRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(tfSubjects)
    .where(eq(tfSubjects.tenantId, tenantId))
    .limit(100);

  return c.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: rows.length,
    Resources: rows.map(toScimUser),
  });
});

/** GET /scim/v2/Users/:id */
scimUserRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const [row] = await db
    .select()
    .from(tfSubjects)
    .where(and(eq(tfSubjects.id, c.req.param('id')), eq(tfSubjects.tenantId, tenantId)))
    .limit(1);
  if (!row) return c.json(scimError('User not found', '404'), 404);
  return c.json(toScimUser(row));
});

/** POST /scim/v2/Users — provision a new subject */
scimUserRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json(scimError('Invalid payload', '400'), 400);

  const email = parsed.data.emails?.find((e) => e.primary)?.value
    ?? parsed.data.emails?.[0]?.value ?? null;
  const id = `tf-sub-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.insert(tfSubjects).values({
    id,
    tenantId,
    workforceAppId: 'scim',
    externalSubject: parsed.data.externalId ?? parsed.data.userName,
    email,
    name: parsed.data.name?.formatted ?? null,
    metadata: JSON.stringify({ scimProvisioned: true, active: parsed.data.active ?? true }),
    firstSeenAt: now,
    lastSeenAt: now,
  });

  c.status(201);
  return c.json(toScimUser({
    id,
    externalSubject: parsed.data.externalId ?? parsed.data.userName,
    email,
    name: parsed.data.name?.formatted ?? null,
    metadata: JSON.stringify({ scimProvisioned: true, active: parsed.data.active ?? true }),
  }));
});

/** PATCH /scim/v2/Users/:id — update subject (Okta sends PATCH for deactivation) */
scimUserRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(tfSubjects)
    .where(and(eq(tfSubjects.id, id), eq(tfSubjects.tenantId, tenantId)))
    .limit(1);
  if (!existing) return c.json(scimError('User not found', '404'), 404);

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const ops = (body.Operations ?? []) as Array<{ op: string; path?: string; value?: unknown }>;
  let active = true;
  for (const op of ops) {
    if (op.path === 'active' && op.op === 'replace') active = op.value === true;
  }

  await db
    .update(tfSubjects)
    .set({
      metadata: JSON.stringify({ ...parseMetadata(existing.metadata), active }),
      lastSeenAt: new Date().toISOString(),
    })
    .where(eq(tfSubjects.id, id));

  return c.json(toScimUser({ ...existing, metadata: JSON.stringify({ active }) }));
});

/** DELETE /scim/v2/Users/:id */
scimUserRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  await db
    .delete(tfSubjects)
    .where(and(eq(tfSubjects.id, c.req.param('id')), eq(tfSubjects.tenantId, tenantId)));
  return c.body(null, 204);
});

function toScimUser(row: {
  id: string; externalSubject: string; email: string | null;
  name: string | null; metadata: string | null;
}): Record<string, unknown> {
  const meta = parseMetadata(row.metadata);
  return {
    schemas: [SCIM_SCHEMA],
    id: row.id,
    userName: row.externalSubject,
    externalId: row.externalSubject,
    name: row.name ? { formatted: row.name } : undefined,
    emails: row.email ? [{ value: row.email, primary: true }] : [],
    active: meta.active ?? true,
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function scimError(detail: string, status: string): Record<string, unknown> {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status,
  };
}
