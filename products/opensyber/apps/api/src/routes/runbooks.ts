/**
 * Runbook engine — HTTP API.
 *
 *   GET  /api/runbooks                 list runbook definitions
 *   POST /api/runbooks/runs            trigger a new run
 *   GET  /api/runbooks/runs            list recent runs (status filter)
 *   GET  /api/runbooks/runs/:id        return run + its step logs
 */

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { tfRunbookRuns, tfRunbookStepLogs } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { findRunbook, loadRunbooks } from '../services/runbooks/loader.js';
import { executeRunbook } from '../services/runbooks/executor.js';

export const runbookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
runbookRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const VALID_RUN_STATUSES = new Set([
  'pending', 'running', 'completed', 'failed', 'cancelled',
]);

const triggerSchema = z.object({
  runbook_id: z.string().min(1),
  trigger_alert_id: z.string().nullable().optional(),
  params: z.record(z.unknown()).optional(),
  trigger_source: z.string().min(1).max(64).optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId
    ? eq(tfRunbookRuns.orgId, orgId)
    : eq(tfRunbookRuns.ownerUserId, userId);
}

// GET /api/runbooks — list runbook definitions
runbookRoutes.get('/', (c) => {
  const registry = loadRunbooks();
  return c.json({
    data: registry.map((rb) => ({
      id: rb.id,
      name: rb.name,
      description: rb.description ?? null,
      trigger: rb.trigger,
      step_count: rb.steps.length,
    })),
  });
});

// POST /api/runbooks/runs — trigger a runbook execution
runbookRoutes.post('/runs', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const registry = loadRunbooks();
  const rb = findRunbook(parsed.data.runbook_id, registry);
  if (!rb) {
    return c.json({ error: 'not_found', message: 'runbook_id not registered' }, 404);
  }

  const state = await executeRunbook({
    db,
    runbook: rb,
    ownerUserId: userId,
    orgId,
    triggerAlertId: parsed.data.trigger_alert_id ?? null,
    triggerSource: parsed.data.trigger_source ?? 'manual',
    params: parsed.data.params ?? {},
    services: {
      db,
      kv: c.env?.CACHE,
      env: c.env as unknown as Record<string, unknown> | undefined,
    },
  });

  return c.json({ data: state }, 201);
});

// GET /api/runbooks/runs — list recent runs
runbookRoutes.get('/runs', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const statusFilter = c.req.query('status');

  const conditions = [ownerCondition(orgId, userId)];
  if (statusFilter && VALID_RUN_STATUSES.has(statusFilter)) {
    conditions.push(eq(tfRunbookRuns.status, statusFilter as 'running'));
  }

  const rows = await db
    .select()
    .from(tfRunbookRuns)
    .where(and(...conditions))
    .orderBy(desc(tfRunbookRuns.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: rows, hasMore: rows.length === limit });
});

// GET /api/runbooks/runs/:id — return run + step logs
runbookRoutes.get('/runs/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [run] = await db
    .select()
    .from(tfRunbookRuns)
    .where(and(eq(tfRunbookRuns.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!run) return c.json({ error: 'not_found' }, 404);

  const steps = await db
    .select()
    .from(tfRunbookStepLogs)
    .where(eq(tfRunbookStepLogs.runId, id))
    .orderBy(tfRunbookStepLogs.stepIndex);

  return c.json({ data: { run, steps } });
});
