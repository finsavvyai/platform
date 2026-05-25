/**
 * OpenSyber DNS firewall — CRUD API for tf_dns_tenants.
 *
 * Each row represents a per-tenant Unbound + RPZ resolver. VM provisioning
 * is owned by agent-runtime; this API only manages orchestration metadata.
 *
 *   GET    /api/dns/tenants              list current org/user's resolvers
 *   POST   /api/dns/tenants              create (vm_id + resolver_ip optional)
 *   PATCH  /api/dns/tenants/:id          pause/resume/update fields
 *   DELETE /api/dns/tenants/:id          soft-delete (status='deleted')
 *
 * Mirrors apps/api/src/routes/ztna-apps.ts auth + zod validation pattern.
 */

import { Hono } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfDnsTenants } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

export const dnsTenantRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
dnsTenantRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const TENANT_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

const createSchema = z.object({
  tenantName: z
    .string()
    .min(1)
    .max(63)
    .regex(TENANT_NAME_RE, 'tenantName must be a DNS-safe label'),
  vmId: z.string().min(1).max(128).optional(),
  resolverIp: z.string().regex(IPV4_RE, 'resolverIp must be IPv4 dotted-quad').optional(),
});

const updateSchema = z.object({
  vmId: z.string().min(1).max(128).optional(),
  resolverIp: z.string().regex(IPV4_RE).optional(),
  status: z.enum(['provisioning', 'active', 'paused', 'error']).optional(),
  blockedCount24h: z.number().int().min(0).optional(),
  lastSyncAt: z.string().datetime().optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId
    ? eq(tfDnsTenants.orgId, orgId)
    : eq(tfDnsTenants.ownerUserId, userId);
}

dnsTenantRoutes.get('/tenants', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const rows = await db
    .select()
    .from(tfDnsTenants)
    .where(and(ownerCondition(orgId, userId), ne(tfDnsTenants.status, 'deleted')));

  return c.json({ data: rows });
});

dnsTenantRoutes.post('/tenants', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  // Tenant name unique per owner — prevents accidental duplicate resolvers.
  const [existing] = await db
    .select({ id: tfDnsTenants.id })
    .from(tfDnsTenants)
    .where(
      and(
        eq(tfDnsTenants.tenantName, parsed.data.tenantName),
        ownerCondition(orgId, userId),
        ne(tfDnsTenants.status, 'deleted'),
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
  const status = parsed.data.resolverIp ? 'active' : 'provisioning';
  await db.insert(tfDnsTenants).values({
    id,
    ownerUserId: userId,
    orgId,
    tenantName: parsed.data.tenantName,
    vmId: parsed.data.vmId ?? null,
    resolverIp: parsed.data.resolverIp ?? null,
    status,
    blockedCount24h: 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ data: { id, ...parsed.data, status } }, 201);
});

dnsTenantRoutes.patch('/tenants/:id', async (c) => {
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
    .select()
    .from(tfDnsTenants)
    .where(and(eq(tfDnsTenants.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfDnsTenants)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(tfDnsTenants.id, id));

  return c.json({ data: { id, ...parsed.data } });
});

dnsTenantRoutes.delete('/tenants/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [row] = await db
    .select({ id: tfDnsTenants.id })
    .from(tfDnsTenants)
    .where(and(eq(tfDnsTenants.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfDnsTenants)
    .set({ status: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(tfDnsTenants.id, id));

  return c.json({ data: { id, status: 'deleted' } });
});
