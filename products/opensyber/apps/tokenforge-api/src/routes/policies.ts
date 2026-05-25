/**
 * Tenant policy CRUD — /v1/policies.
 *
 *   GET    /v1/policies         list active + disabled policies
 *   POST   /v1/policies         create policy { name, rules, priority?, enabled? }
 *   PATCH  /v1/policies/:id     update name/rules/priority/enabled
 *   DELETE /v1/policies/:id     hard delete
 *
 * Rules JSON is validated server-side via parsePolicyRules so a malformed
 * policy is rejected at write time, not silently ignored at refresh time.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { tfPolicies } from '@opensyber/db';
import { parsePolicyRules } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  rules: z.string().min(2).max(8192),
  priority: z.number().int().min(0).max(10_000).optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const policyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

policyRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(tfPolicies)
    .where(eq(tfPolicies.tenantId, tenantId))
    .orderBy(asc(tfPolicies.priority));
  return c.json({ data: rows });
});

policyRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }
  if (!parsePolicyRules(parsed.data.rules)) {
    return c.json({ error: 'invalid_rules' }, 400);
  }

  const id = `tf-pol-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.insert(tfPolicies).values({
    id,
    tenantId,
    name: parsed.data.name,
    rules: parsed.data.rules,
    priority: parsed.data.priority ?? 100,
    enabled: parsed.data.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ data: { id, name: parsed.data.name } }, 201);
});

policyRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }
  if (parsed.data.rules !== undefined && !parsePolicyRules(parsed.data.rules)) {
    return c.json({ error: 'invalid_rules' }, 400);
  }

  const [existing] = await db
    .select()
    .from(tfPolicies)
    .where(and(eq(tfPolicies.id, id), eq(tfPolicies.tenantId, tenantId)))
    .limit(1);
  if (!existing) return c.json({ error: 'policy_not_found' }, 404);

  await db
    .update(tfPolicies)
    .set({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.rules !== undefined && { rules: parsed.data.rules }),
      ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(tfPolicies.id, id), eq(tfPolicies.tenantId, tenantId)));
  return c.json({ data: { id, updated: true } });
});

policyRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const [existing] = await db
    .select()
    .from(tfPolicies)
    .where(and(eq(tfPolicies.id, id), eq(tfPolicies.tenantId, tenantId)))
    .limit(1);
  if (!existing) return c.json({ error: 'policy_not_found' }, 404);

  await db
    .delete(tfPolicies)
    .where(and(eq(tfPolicies.id, id), eq(tfPolicies.tenantId, tenantId)));
  return c.json({ data: { id, deleted: true } });
});
