/**
 * OpenSyber Remote Browser Isolation — session orchestration endpoints.
 *
 *   POST   /api/rbi/sessions          start an isolated browser session
 *   GET    /api/rbi/sessions/:id      poll status (proxies Kasm get_kasm_status)
 *   DELETE /api/rbi/sessions/:id      terminate (proxies Kasm destroy_kasm)
 *
 * Pure routing only — crypto, Kasm client construction, and error mapping
 * live in `./sessions-helpers.ts` to keep this file under the 200-line cap.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfRbiTenants, tfRbiSessions } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { resolveOrgContext } from '../../middleware/rbac.js';
import { kasmErrorResponse, loadKasmSecret, makeKasmClient } from './sessions-helpers.js';

export const rbiSessionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
rbiSessionRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const createSchema = z.object({
  tenantId: z.string().min(1),
  targetUrl: z.string().url('targetUrl must be a valid URL'),
  imageId: z.string().min(1).max(256).optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId
    ? eq(tfRbiTenants.orgId, orgId)
    : eq(tfRbiTenants.ownerUserId, userId);
}

rbiSessionRoutes.post('/sessions', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [tenant] = await db
    .select()
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, parsed.data.tenantId), ownerCondition(orgId, userId)))
    .limit(1);
  if (!tenant) return c.json({ error: 'tenant_not_found' }, 404);
  if (tenant.status !== 'active') {
    return c.json({ error: 'tenant_not_active', status: tenant.status }, 409);
  }

  const apiKeySecret = await loadKasmSecret(c.env, tenant);
  if (!apiKeySecret) return c.json({ error: 'tenant_secret_unreadable' }, 500);

  const imageId = parsed.data.imageId ?? tenant.defaultImageId;
  const client = makeKasmClient(tenant, apiKeySecret);

  let result;
  try {
    result = await client.requestKasm({ userId, imageId, goUrl: parsed.data.targetUrl });
  } catch (err) {
    const { status, body: errBody } = kasmErrorResponse(err);
    return c.json(errBody, status);
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(tfRbiSessions).values({
    id,
    tenantId: tenant.id,
    kasmId: result.kasm_id,
    userIdExternal: userId,
    imageId,
    sourceUrl: parsed.data.targetUrl,
    status: 'active',
    startedAt: now,
  });

  return c.json(
    { data: { id, kasmId: result.kasm_id, kasmUrl: result.kasm_url ?? null, status: 'active' } },
    201,
  );
});

rbiSessionRoutes.get('/sessions/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [session] = await db
    .select()
    .from(tfRbiSessions)
    .where(eq(tfRbiSessions.id, id))
    .limit(1);
  if (!session) return c.json({ error: 'not_found' }, 404);

  const [tenant] = await db
    .select()
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, session.tenantId), ownerCondition(orgId, userId)))
    .limit(1);
  if (!tenant) return c.json({ error: 'not_found' }, 404);

  if (session.status !== 'active') return c.json({ data: session });

  const apiKeySecret = await loadKasmSecret(c.env, tenant);
  if (!apiKeySecret) return c.json({ data: session });

  const client = makeKasmClient(tenant, apiKeySecret);
  try {
    const status = await client.getKasmStatus(session.kasmId, session.userIdExternal);
    return c.json({ data: { ...session, kasmStatus: status } });
  } catch (err) {
    const { status: code, body } = kasmErrorResponse(err);
    return c.json({ data: session, upstream: body }, code);
  }
});

rbiSessionRoutes.delete('/sessions/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [session] = await db
    .select()
    .from(tfRbiSessions)
    .where(eq(tfRbiSessions.id, id))
    .limit(1);
  if (!session) return c.json({ error: 'not_found' }, 404);

  const [tenant] = await db
    .select()
    .from(tfRbiTenants)
    .where(and(eq(tfRbiTenants.id, session.tenantId), ownerCondition(orgId, userId)))
    .limit(1);
  if (!tenant) return c.json({ error: 'not_found' }, 404);

  if (session.status === 'active') {
    const apiKeySecret = await loadKasmSecret(c.env, tenant);
    if (apiKeySecret) {
      const client = makeKasmClient(tenant, apiKeySecret);
      try {
        await client.destroyKasm(session.kasmId, session.userIdExternal);
      } catch (err) {
        const now = new Date().toISOString();
        await db
          .update(tfRbiSessions)
          .set({ status: 'error', endedAt: now })
          .where(eq(tfRbiSessions.id, id));
        const { status, body } = kasmErrorResponse(err);
        return c.json(body, status);
      }
    }
  }

  const now = new Date().toISOString();
  await db
    .update(tfRbiSessions)
    .set({ status: 'ended', endedAt: now })
    .where(eq(tfRbiSessions.id, id));

  return c.json({ data: { id, status: 'ended' } });
});
