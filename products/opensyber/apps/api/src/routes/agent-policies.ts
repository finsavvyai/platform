import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { agentPolicies, agentPolicyViolations } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContextAutoDetect } from '../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../middleware/plan-enforcement.js';
import { hasPermission } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import { createAgentPolicySchema, updateAgentPolicySchema } from './validation/agent-policies.js';

export const agentPolicyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentPolicyRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect, loadPlanConfig, requirePlanFeature('policyEngine'));

function canWrite(role: Role | null): boolean { return !role || hasPermission(role, 'agent.policy.write'); }
function canRead(role: Role | null): boolean { return !role || hasPermission(role, 'agent.policy.read'); }
function requireOrg(orgId: string | null): string | null { return orgId; }

// GET /api/agents/policies
agentPolicyRoutes.get('/policies', async (c) => {
  if (!canRead(c.get('role'))) return c.json({ error: 'Forbidden', message: 'agent.policy.read required' }, 403);
  const orgId = requireOrg(c.get('orgId'));
  if (!orgId) return c.json({ error: 'Bad request', message: 'Org context required' }, 400);

  const policies = await c.get('db').select().from(agentPolicies)
    .where(eq(agentPolicies.orgId, orgId)).orderBy(desc(agentPolicies.createdAt));
  return c.json({ data: policies });
});

// POST /api/agents/policies
agentPolicyRoutes.post('/policies', async (c) => {
  if (!canWrite(c.get('role'))) return c.json({ error: 'Forbidden', message: 'agent.policy.write required' }, 403);
  const orgId = requireOrg(c.get('orgId'));
  if (!orgId) return c.json({ error: 'Bad request', message: 'Org context required' }, 400);

  const parsed = createAgentPolicySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const configStr = typeof body.ruleConfig === 'string' ? body.ruleConfig : JSON.stringify(body.ruleConfig);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const db = c.get('db');

  await db.insert(agentPolicies).values({
    id, orgId, name: body.name,
    description: body.description ?? null,
    ruleType: body.ruleType,
    ruleConfig: configStr,
    severity: body.severity,
    isActive: true, createdBy: c.get('userId'), createdAt: now, updatedAt: now,
  });

  const [policy] = await db.select().from(agentPolicies).where(eq(agentPolicies.id, id));
  return c.json({ data: policy }, 201);
});

// PATCH /api/agents/policies/:id
agentPolicyRoutes.patch('/policies/:id', async (c) => {
  if (!canWrite(c.get('role'))) return c.json({ error: 'Forbidden', message: 'agent.policy.write required' }, 403);
  const orgId = requireOrg(c.get('orgId'));
  if (!orgId) return c.json({ error: 'Bad request', message: 'Org context required' }, 400);

  const db = c.get('db');
  const policyId = c.req.param('id');
  const [existing] = await db.select().from(agentPolicies)
    .where(and(eq(agentPolicies.id, policyId), eq(agentPolicies.orgId, orgId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Policy not found' }, 404);

  const parsed = updateAgentPolicySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.severity) updates.severity = body.severity;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.ruleConfig !== undefined) {
    updates.ruleConfig = typeof body.ruleConfig === 'string' ? body.ruleConfig : JSON.stringify(body.ruleConfig);
  }

  await db.update(agentPolicies).set(updates).where(eq(agentPolicies.id, policyId));
  const [updated] = await db.select().from(agentPolicies).where(eq(agentPolicies.id, policyId));
  return c.json({ data: updated });
});

// DELETE /api/agents/policies/:id
agentPolicyRoutes.delete('/policies/:id', async (c) => {
  if (!canWrite(c.get('role'))) return c.json({ error: 'Forbidden', message: 'agent.policy.write required' }, 403);
  const orgId = requireOrg(c.get('orgId'));
  if (!orgId) return c.json({ error: 'Bad request', message: 'Org context required' }, 400);

  const db = c.get('db');
  const policyId = c.req.param('id');
  const [existing] = await db.select().from(agentPolicies)
    .where(and(eq(agentPolicies.id, policyId), eq(agentPolicies.orgId, orgId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Policy not found' }, 404);

  await db.delete(agentPolicies).where(eq(agentPolicies.id, policyId));
  return c.json({ data: { deleted: true } });
});

// GET /api/agents/policies/:id/violations
agentPolicyRoutes.get('/policies/:id/violations', async (c) => {
  if (!canRead(c.get('role'))) return c.json({ error: 'Forbidden', message: 'agent.policy.read required' }, 403);
  const orgId = requireOrg(c.get('orgId'));
  if (!orgId) return c.json({ error: 'Bad request', message: 'Org context required' }, 400);

  const db = c.get('db');
  const policyId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const [policy] = await db.select().from(agentPolicies)
    .where(and(eq(agentPolicies.id, policyId), eq(agentPolicies.orgId, orgId)));
  if (!policy) return c.json({ error: 'Not found', message: 'Policy not found' }, 404);

  const violations = await db.select().from(agentPolicyViolations)
    .where(eq(agentPolicyViolations.policyId, policyId))
    .orderBy(desc(agentPolicyViolations.createdAt)).limit(limit).offset(offset);

  return c.json({ data: violations, hasMore: violations.length === limit });
});
