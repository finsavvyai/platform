import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { securityPolicies } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { createPolicySchema, updatePolicySchema } from './validation/policies.js';

const policyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

policyRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List policies for an instance
policyRoutes.get('/instances/:instanceId/policies', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, c.req.param('instanceId'), c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const policies = await db.select().from(securityPolicies)
    .where(eq(securityPolicies.instanceId, c.req.param('instanceId')));
  return c.json({ policies });
});

// Create a policy
policyRoutes.post('/instances/:instanceId/policies', requirePermission('policy.create'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const parsed = createPolicySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const now = new Date().toISOString();
  const policy = {
    id: crypto.randomUUID(), instanceId,
    policyType: body.policyType as typeof securityPolicies.$inferInsert.policyType,
    name: body.name, rules: body.rules, isActive: true, createdAt: now, updatedAt: now,
  };

  await db.insert(securityPolicies).values(policy);
  return c.json({ policy }, 201);
});

// Update a policy
policyRoutes.patch('/instances/:instanceId/policies/:id', requirePermission('policy.update'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const policyId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(securityPolicies)
    .where(and(eq(securityPolicies.id, policyId), eq(securityPolicies.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Policy not found' }, 404);

  const parsed = updatePolicySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.rules !== undefined) updates.rules = body.rules;

  await db.update(securityPolicies).set(updates).where(eq(securityPolicies.id, policyId));
  const [updated] = await db.select().from(securityPolicies).where(eq(securityPolicies.id, policyId));
  return c.json({ policy: updated });
});

// Delete a policy
policyRoutes.delete('/instances/:instanceId/policies/:id', requirePermission('policy.delete'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const policyId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(securityPolicies)
    .where(and(eq(securityPolicies.id, policyId), eq(securityPolicies.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Policy not found' }, 404);

  await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  return c.json({ deleted: true });
});

// Agent-facing policy routes (gateway auth)
const gatewayPolicyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

gatewayPolicyRoutes.use('*', dbMiddleware, gatewayAuthMiddleware);

gatewayPolicyRoutes.get('/instances/:instanceId/policies', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const headerInstanceId = c.req.header('X-Instance-Id');
  if (instanceId !== headerInstanceId) {
    return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  }

  const policies = await db.select().from(securityPolicies)
    .where(and(eq(securityPolicies.instanceId, instanceId), eq(securityPolicies.isActive, true)));
  return c.json({ policies });
});

export { policyRoutes, gatewayPolicyRoutes };
