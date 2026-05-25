/**
 * Secret Rotation Policy Routes
 *
 * CRUD for vault rotation policies + evaluation endpoint.
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { vaultRotationPolicies } from '@opensyber/db';
import { evaluateRotationPolicies } from '../services/rotation-evaluator.js';
import { getSecretAging } from '../services/secret-age-tracker.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createRotationPolicySchema } from './validation/vault-rotation.js';

export const vaultRotationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

vaultRotationRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

vaultRotationRoutes.get('/rotation-policies', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const policies = await db.select().from(vaultRotationPolicies)
    .where(eq(vaultRotationPolicies.orgId, orgId));
  return c.json({ data: policies });
});

vaultRotationRoutes.get('/aging', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const summary = await getSecretAging(db, orgId);
  return c.json({ data: summary });
});

vaultRotationRoutes.get('/rotation-policies/evaluate', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const statuses = await evaluateRotationPolicies(db, orgId);
  return c.json({ data: statuses });
});

vaultRotationRoutes.post('/rotation-policies', requirePermission('vault.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createRotationPolicySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await db.insert(vaultRotationPolicies).values({
    id,
    orgId,
    secretPattern: parsed.data.secretPattern,
    rotationIntervalDays: parsed.data.rotationIntervalDays,
    notifyChannelId: parsed.data.notifyChannelId ?? null,
    status: 'active',
  });
  return c.json({ data: { id } }, 201);
});

vaultRotationRoutes.delete('/rotation-policies/:id', requirePermission('vault.delete'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  await db.delete(vaultRotationPolicies).where(
    and(eq(vaultRotationPolicies.id, c.req.param('id')), eq(vaultRotationPolicies.orgId, orgId)),
  );
  return c.json({ data: { deleted: true } });
});
