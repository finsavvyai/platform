/**
 * Remediation Run Routes
 *
 * Execute playbooks with state machine tracking, auto-triggers, and run history.
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { remediationPlaybooks, remediationRuns } from '@opensyber/db';
import { executePlaybook, parseSteps, computeState, shouldAutoTrigger } from '../services/playbook-executor.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createRunSchema } from './validation/remediation.js';
import { autoTriggerSchema } from './validation/remediation-runs.js';

export const remediationRunRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

remediationRunRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

remediationRunRoutes.get('/runs', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const runs = await db.select().from(remediationRuns)
    .where(eq(remediationRuns.orgId, orgId))
    .orderBy(desc(remediationRuns.startedAt))
    .limit(50);

  const enriched = runs.map((run) => ({
    ...run,
    state: computeState(run.totalSteps ?? 0, run.currentStep ?? 0, run.status === 'failed'),
  }));
  return c.json({ data: enriched });
});

/** GET /runs/:id — Get a single run with state */
remediationRunRoutes.get('/runs/:id', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const [run] = await db.select().from(remediationRuns)
    .where(and(eq(remediationRuns.id, c.req.param('id')), eq(remediationRuns.orgId, orgId)));
  if (!run) return c.json({ error: 'Not found', message: 'Run not found' }, 404);

  const state = computeState(run.totalSteps ?? 0, run.currentStep ?? 0, run.status === 'failed');
  return c.json({ data: { ...run, state } });
});

/** POST /runs/:id/cancel — Cancel a running run */
remediationRunRoutes.post('/runs/:id/cancel', requirePermission('policy.create'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const [run] = await db.select().from(remediationRuns)
    .where(and(eq(remediationRuns.id, c.req.param('id')), eq(remediationRuns.orgId, orgId)));
  if (!run) return c.json({ error: 'Not found', message: 'Run not found' }, 404);
  if (run.status !== 'running') {
    return c.json({ error: 'Conflict', message: `Cannot cancel run with status '${run.status}'` }, 409);
  }
  await db.update(remediationRuns)
    .set({ status: 'cancelled', completedAt: new Date().toISOString() })
    .where(eq(remediationRuns.id, c.req.param('id')));
  return c.json({ data: { id: run.id, status: 'cancelled' } });
});

/** POST /runs — Execute a playbook (manual trigger) */
remediationRunRoutes.post('/runs', requirePermission('policy.create'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const userId = c.get('userId');
  const db = c.get('db');
  const parsed = createRunSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);

  const [playbook] = await db.select().from(remediationPlaybooks)
    .where(and(
      eq(remediationPlaybooks.id, parsed.data.playbookId),
      eq(remediationPlaybooks.orgId, orgId),
    ));
  if (!playbook) return c.json({ error: 'Playbook not found' }, 404);

  const steps = parseSteps(playbook.steps);
  const runId = crypto.randomUUID();
  await db.insert(remediationRuns).values({
    id: runId, orgId,
    playbookId: playbook.id,
    triggeredBy: userId,
    totalSteps: steps.length,
    status: 'running',
  });

  const ctx = { env: c.env, db: db as any, orgId };
  const result = await executePlaybook(steps, ctx);
  const state = computeState(steps.length, result.completedSteps, result.status === 'failed');
  await db.update(remediationRuns)
    .set({
      status: result.status,
      currentStep: result.completedSteps,
      stepResults: JSON.stringify(result.stepResults),
      completedAt: new Date().toISOString(),
    })
    .where(eq(remediationRuns.id, runId));

  return c.json({
    data: { runId, status: result.status, state, currentStep: result.currentStep,
      completedSteps: result.completedSteps, error: result.error },
  }, 201);
});

/** POST /runs/auto-trigger — Check all auto-playbooks against an event */
remediationRunRoutes.post('/runs/auto-trigger', requirePermission('policy.create'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const userId = c.get('userId');
  const db = c.get('db');
  const parsedTrigger = autoTriggerSchema.safeParse(await c.req.json());
  if (!parsedTrigger.success) return c.json({ error: 'Invalid input', details: parsedTrigger.error.issues[0]?.message }, 400);

  const playbooks = await db.select().from(remediationPlaybooks)
    .where(eq(remediationPlaybooks.orgId, orgId));

  const triggered: string[] = [];
  for (const pb of playbooks) {
    const triggerConfig = pb.triggerConfig ? JSON.parse(pb.triggerConfig) : null;
    if (!shouldAutoTrigger(pb.triggerType ?? 'manual', triggerConfig, parsedTrigger.data)) continue;

    const steps = parseSteps(pb.steps);
    const runId = crypto.randomUUID();
    await db.insert(remediationRuns).values({
      id: runId, orgId, playbookId: pb.id, triggeredBy: userId,
      totalSteps: steps.length, status: 'running',
    });

    const ctx = { env: c.env, db: db as any, orgId };
    const result = await executePlaybook(steps, ctx);
    await db.update(remediationRuns)
      .set({
        status: result.status, currentStep: result.completedSteps,
        stepResults: JSON.stringify(result.stepResults),
        completedAt: new Date().toISOString(),
      })
      .where(eq(remediationRuns.id, runId));

    triggered.push(runId);
  }

  return c.json({ data: { triggeredRuns: triggered, count: triggered.length } });
});
