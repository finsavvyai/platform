/**
 * OpenSyber Squid SWG — CRUD API for tf_swg_tenants.
 *
 * Each row represents one customer Secure Web Gateway instance. The Squid +
 * e2guardian VM lifecycle is owned by agent-runtime; this API only manages
 * orchestration metadata + policy.
 *
 *   GET    /api/swg/tenants              list current owner's SWG tenants
 *   POST   /api/swg/tenants              create
 *   PATCH  /api/swg/tenants/:id          update mutable fields
 *   DELETE /api/swg/tenants/:id          hard-delete (no soft-delete column)
 *
 * Mirrors apps/api/src/routes/dns-tenants.ts auth + zod validation pattern.
 * SWG schema is keyed on `tenant_id` only; we derive it from orgId or userId.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfSwgTenants } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

export const swgTenantRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
swgTenantRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const HOST_PORT_RE = /^[a-z0-9.-]+:\d{1,5}$/i;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  upstreamProxy: z.string().regex(HOST_PORT_RE, 'host:port required').nullish(),
  defaultAction: z.enum(['allow', 'block']).optional(),
  categoriesBlocked: z.array(z.string()).max(64).optional(),
  domainsAllowlist: z.array(z.string()).max(2048).optional(),
  domainsBlocklist: z.array(z.string()).max(2048).optional(),
  tlsIntercept: z.boolean().optional(),
  bytesLimitDaily: z.number().int().min(0).optional(),
});

const updateSchema = createSchema.partial();

function ownerTenantId(orgId: string | null, userId: string): string {
  return orgId ?? userId;
}

swgTenantRoutes.get('/tenants', async (c) => {
  const db = c.get('db');
  const tenantId = ownerTenantId(c.get('orgId') ?? null, c.get('userId'));

  const rows = await db
    .select()
    .from(tfSwgTenants)
    .where(eq(tfSwgTenants.tenantId, tenantId));

  return c.json({ data: rows });
});

swgTenantRoutes.post('/tenants', async (c) => {
  const db = c.get('db');
  const tenantId = ownerTenantId(c.get('orgId') ?? null, c.get('userId'));

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(tfSwgTenants).values({
    id,
    tenantId,
    name: parsed.data.name,
    upstreamProxy: parsed.data.upstreamProxy ?? null,
    defaultAction: parsed.data.defaultAction ?? 'allow',
    categoriesBlocked: JSON.stringify(parsed.data.categoriesBlocked ?? []),
    domainsAllowlist: JSON.stringify(parsed.data.domainsAllowlist ?? []),
    domainsBlocklist: JSON.stringify(parsed.data.domainsBlocklist ?? []),
    tlsIntercept: parsed.data.tlsIntercept ?? false,
    bytesLimitDaily: parsed.data.bytesLimitDaily ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ data: { id, ...parsed.data } }, 201);
});

swgTenantRoutes.patch('/tenants/:id', async (c) => {
  const db = c.get('db');
  const tenantId = ownerTenantId(c.get('orgId') ?? null, c.get('userId'));
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [row] = await db
    .select({ id: tfSwgTenants.id })
    .from(tfSwgTenants)
    .where(and(eq(tfSwgTenants.id, id), eq(tfSwgTenants.tenantId, tenantId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.upstreamProxy !== undefined) update.upstreamProxy = parsed.data.upstreamProxy;
  if (parsed.data.defaultAction !== undefined) update.defaultAction = parsed.data.defaultAction;
  if (parsed.data.tlsIntercept !== undefined) update.tlsIntercept = parsed.data.tlsIntercept;
  if (parsed.data.bytesLimitDaily !== undefined) update.bytesLimitDaily = parsed.data.bytesLimitDaily;
  if (parsed.data.categoriesBlocked !== undefined) {
    update.categoriesBlocked = JSON.stringify(parsed.data.categoriesBlocked);
  }
  if (parsed.data.domainsAllowlist !== undefined) {
    update.domainsAllowlist = JSON.stringify(parsed.data.domainsAllowlist);
  }
  if (parsed.data.domainsBlocklist !== undefined) {
    update.domainsBlocklist = JSON.stringify(parsed.data.domainsBlocklist);
  }

  await db.update(tfSwgTenants).set(update).where(eq(tfSwgTenants.id, id));
  return c.json({ data: { id, ...parsed.data } });
});

swgTenantRoutes.delete('/tenants/:id', async (c) => {
  const db = c.get('db');
  const tenantId = ownerTenantId(c.get('orgId') ?? null, c.get('userId'));
  const id = c.req.param('id');

  const result = await db
    .delete(tfSwgTenants)
    .where(and(eq(tfSwgTenants.id, id), eq(tfSwgTenants.tenantId, tenantId)));

  // Drizzle D1 returns { meta: { changes: n } }; we just ack on success path.
  void result;
  return c.json({ data: { id, deleted: true } });
});
