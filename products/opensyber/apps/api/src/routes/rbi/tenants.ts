/**
 * OpenSyber Remote Browser Isolation — CRUD API for tf_rbi_tenants.
 *
 * Each row represents one Kasm Workspaces cluster the customer operates.
 * VM provisioning lives in agent-runtime; this API only manages
 * orchestration metadata + the encrypted Kasm API secret.
 *
 *   GET    /api/rbi/tenants          list current org/user's RBI tenants
 *   POST   /api/rbi/tenants          create
 *   PATCH  /api/rbi/tenants/:id      update mutable fields
 *   DELETE /api/rbi/tenants/:id      soft-delete (status='deleted')
 *
 * Mirrors apps/api/src/routes/dns-tenants.ts auth + zod validation pattern.
 */

import { Hono } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfRbiTenants } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { resolveOrgContext } from '../../middleware/rbac.js';

export const rbiTenantRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
rbiTenantRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const TENANT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,62}$/;

const createSchema = z.object({
  tenantName: z.string().min(1).max(63).regex(TENANT_NAME_RE, 'tenantName invalid'),
  kasmApiUrl: z.string().url('kasmApiUrl must be a valid URL'),
  kasmApiKeyId: z.string().min(1).max(128),
  apiKeySecretEncrypted: z.string().min(1).max(2048),
  defaultImageId: z.string().min(1).max(256),
  defaultWorkspaceId: z.string().min(1).max(256).optional(),
  sessionMaxSeconds: z.number().int().min(60).max(86_400).optional(),
});

const updateSchema = z.object({
  tenantName: z.string().min(1).max(63).regex(TENANT_NAME_RE).optional(),
  kasmApiUrl: z.string().url().optional(),
  kasmApiKeyId: z.string().min(1).max(128).optional(),
  apiKeySecretEncrypted: z.string().min(1).max(2048).optional(),
  defaultImageId: z.string().min(1).max(256).optional(),
  defaultWorkspaceId: z.string().min(1).max(256).optional(),
  sessionMaxSeconds: z.number().int().min(60).max(86_400).optional(),
  status: z.enum(['provisioning', 'active', 'paused', 'error']).optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId
    ? eq(tfRbiTenants.orgId, orgId)
    : eq(tfRbiTenants.ownerUserId, userId);
}

rbiTenantRoutes.get('/tenants', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const rows = await db
    .select()
    .from(tfRbiTenants)
    .where(and(ownerCondition(orgId, userId), ne(tfRbiTenants.status, 'deleted')));

  return c.json({ data: rows });
});

rbiTenantRoutes.get('/tenants/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ data: row });
});

rbiTenantRoutes.post('/tenants', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select({ id: tfRbiTenants.id })
    .from(tfRbiTenants)
    .where(
      and(
        eq(tfRbiTenants.tenantName, parsed.data.tenantName),
        ownerCondition(orgId, userId),
        ne(tfRbiTenants.status, 'deleted'),
      ),
    )
    .limit(1);
  if (existing) {
    return c.json(
      { error: 'tenant_name_taken', message: 'Tenant name already in use' },
      409,
    );
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(tfRbiTenants).values({
    id,
    ownerUserId: userId,
    orgId,
    tenantName: parsed.data.tenantName,
    kasmApiUrl: parsed.data.kasmApiUrl,
    kasmApiKeyId: parsed.data.kasmApiKeyId,
    apiKeySecretEncrypted: parsed.data.apiKeySecretEncrypted,
    defaultImageId: parsed.data.defaultImageId,
    defaultWorkspaceId: parsed.data.defaultWorkspaceId ?? null,
    sessionMaxSeconds: parsed.data.sessionMaxSeconds ?? 1800,
    status: 'provisioning',
    activeSessionCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ data: { id, status: 'provisioning' } }, 201);
});

rbiTenantRoutes.patch('/tenants/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [row] = await db
    .select({ id: tfRbiTenants.id })
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfRbiTenants)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(tfRbiTenants.id, id));

  return c.json({ data: { id, ...parsed.data } });
});

rbiTenantRoutes.delete('/tenants/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [row] = await db
    .select({ id: tfRbiTenants.id })
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfRbiTenants)
    .set({ status: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(tfRbiTenants.id, id));

  return c.json({ data: { id, status: 'deleted' } });
});
