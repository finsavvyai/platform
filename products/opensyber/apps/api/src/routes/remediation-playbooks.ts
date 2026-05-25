/**
 * Remediation Playbook Routes
 *
 * CRUD for remediation playbooks and execution triggers.
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { remediationPlaybooks, remediationRuns } from '@opensyber/db';
import { executePlaybook, parseSteps } from '../services/playbook-executor.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createPlaybookSchema, updatePlaybookSchema } from './validation/remediation.js';

export const remediationPlaybookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

remediationPlaybookRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

remediationPlaybookRoutes.get('/playbooks', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const playbooks = await db.select().from(remediationPlaybooks)
    .where(eq(remediationPlaybooks.orgId, orgId))
    .orderBy(desc(remediationPlaybooks.createdAt));
  return c.json({ data: playbooks });
});

remediationPlaybookRoutes.get('/playbooks/:id', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const [playbook] = await db.select().from(remediationPlaybooks)
    .where(and(eq(remediationPlaybooks.id, c.req.param('id')), eq(remediationPlaybooks.orgId, orgId)));
  if (!playbook) return c.json({ error: 'Not found', message: 'Playbook not found' }, 404);
  return c.json({ data: playbook });
});

remediationPlaybookRoutes.put('/playbooks/:id', requirePermission('policy.update'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = updatePlaybookSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const [existing] = await db.select().from(remediationPlaybooks)
    .where(and(eq(remediationPlaybooks.id, c.req.param('id')), eq(remediationPlaybooks.orgId, orgId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Playbook not found' }, 404);
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.steps !== undefined) updates.steps = JSON.stringify(parsed.data.steps);
  await db.update(remediationPlaybooks).set(updates)
    .where(and(eq(remediationPlaybooks.id, c.req.param('id')), eq(remediationPlaybooks.orgId, orgId)));
  return c.json({ data: { id: c.req.param('id'), ...updates } });
});

remediationPlaybookRoutes.post('/playbooks', requirePermission('policy.create'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createPlaybookSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await db.insert(remediationPlaybooks).values({
    id, orgId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    triggerType: parsed.data.triggerType,
    triggerConfig: parsed.data.triggerConfig ? JSON.stringify(parsed.data.triggerConfig) : null,
    steps: JSON.stringify(parsed.data.steps),
  });
  return c.json({ data: { id } }, 201);
});

remediationPlaybookRoutes.delete('/playbooks/:id', requirePermission('policy.delete'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  await db.delete(remediationPlaybooks).where(
    and(eq(remediationPlaybooks.id, c.req.param('id')), eq(remediationPlaybooks.orgId, orgId)),
  );
  return c.json({ data: { deleted: true } });
});
