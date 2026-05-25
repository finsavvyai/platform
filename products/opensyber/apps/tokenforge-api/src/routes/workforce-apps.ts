/**
 * Workforce app CRUD — /v1/workforce/apps.
 *
 * A workforce app binds an OIDC IdP (Okta / Entra / Google Workspace /
 * Auth0 / generic) to a TokenForge tenant so the SSO callback knows
 * which JWKS + audience to verify ID tokens against. Customer-mode
 * tenants do not need to create rows here.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { tfWorkforceApps } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

const idpEnum = z.enum(['oidc_okta', 'oidc_entra', 'oidc_google', 'oidc_auth0', 'oidc_generic']);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  idpType: idpEnum,
  issuer: z.string().url(),
  audience: z.string().min(1).max(256),
  jwksUri: z.string().url(),
  tokenEndpoint: z.string().url().optional(),
  allowedOrigins: z.string().max(2048).optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const workforceAppRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

workforceAppRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(tfWorkforceApps)
    .where(eq(tfWorkforceApps.tenantId, tenantId))
    .orderBy(asc(tfWorkforceApps.createdAt));
  return c.json({ data: rows });
});

workforceAppRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }
  const id = `tf-wf-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.insert(tfWorkforceApps).values({
    id,
    tenantId,
    name: parsed.data.name,
    idpType: parsed.data.idpType,
    issuer: parsed.data.issuer.replace(/\/$/, ''),
    audience: parsed.data.audience,
    jwksUri: parsed.data.jwksUri,
    tokenEndpoint: parsed.data.tokenEndpoint ?? null,
    allowedOrigins: parsed.data.allowedOrigins ?? '',
    enabled: parsed.data.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ data: { id, name: parsed.data.name } }, 201);
});

workforceAppRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }
  const [existing] = await db
    .select()
    .from(tfWorkforceApps)
    .where(and(eq(tfWorkforceApps.id, id), eq(tfWorkforceApps.tenantId, tenantId)))
    .limit(1);
  if (!existing) return c.json({ error: 'workforce_app_not_found' }, 404);

  await db
    .update(tfWorkforceApps)
    .set({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.idpType !== undefined && { idpType: parsed.data.idpType }),
      ...(parsed.data.issuer !== undefined && { issuer: parsed.data.issuer.replace(/\/$/, '') }),
      ...(parsed.data.audience !== undefined && { audience: parsed.data.audience }),
      ...(parsed.data.jwksUri !== undefined && { jwksUri: parsed.data.jwksUri }),
      ...(parsed.data.tokenEndpoint !== undefined && { tokenEndpoint: parsed.data.tokenEndpoint }),
      ...(parsed.data.allowedOrigins !== undefined && { allowedOrigins: parsed.data.allowedOrigins }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(tfWorkforceApps.id, id), eq(tfWorkforceApps.tenantId, tenantId)));
  return c.json({ data: { id, updated: true } });
});

workforceAppRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const [existing] = await db
    .select()
    .from(tfWorkforceApps)
    .where(and(eq(tfWorkforceApps.id, id), eq(tfWorkforceApps.tenantId, tenantId)))
    .limit(1);
  if (!existing) return c.json({ error: 'workforce_app_not_found' }, 404);

  await db
    .delete(tfWorkforceApps)
    .where(and(eq(tfWorkforceApps.id, id), eq(tfWorkforceApps.tenantId, tenantId)));
  return c.json({ data: { id, deleted: true } });
});
