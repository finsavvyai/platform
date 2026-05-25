import { Hono } from 'hono';
import { eq, and, desc, gte } from 'drizzle-orm';
import { agentActivity } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../middleware/plan-enforcement.js';
import { evaluateActivity } from '../services/policy-evaluator.js';
import { discoverAfterActivitySync } from '../services/asset-discovery/hooks.js';
import type { RiskLevel } from './agent-monitor-types.js';
import { validateEvent } from './agent-monitor-types.js';
import { activitySyncSchema } from './validation/agent-monitor.js';

export const agentMonitorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentMonitorRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext, loadPlanConfig);

// POST /api/agents/activity/sync — extension pushes activity batch
agentMonitorRoutes.post('/activity/sync', requirePlanFeature('cloudSync'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const planConfig = c.get('planConfig');

  if (!planConfig) return c.json({ error: 'Internal Error', message: 'Plan config not loaded' }, 500);

  const { config } = planConfig;
  const agentLimit = config.agentLimit as number;
  const historyDays = config.agentHistoryDays as number;

  const parsed = activitySyncSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'events array required' }, 400);
  }

  const valid = parsed.data.events.filter(validateEvent);
  if (valid.length === 0) return c.json({ error: 'Bad request', message: 'no valid events' }, 400);

  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - historyDays);
  const retentionCutoffIso = retentionCutoff.toISOString();

  const withinWindow = valid.filter((e) => e.timestamp >= retentionCutoffIso);
  if (withinWindow.length < valid.length) {
    return c.json({
      error: 'Bad Request',
      message: `${valid.length - withinWindow.length} events outside ${historyDays}-day retention window`,
      rejected: valid.length - withinWindow.length,
    }, 400);
  }

  const existingAgents = await db
    .selectDistinct({ agent: agentActivity.agent })
    .from(agentActivity)
    .where(and(eq(agentActivity.userId, userId), orgId ? eq(agentActivity.orgId, orgId) : undefined, gte(agentActivity.createdAt, retentionCutoffIso)))
    .limit(agentLimit + 1);

  const existingAgentSet = new Set(existingAgents.map((a) => a.agent));
  for (const agent of new Set(withinWindow.map((e) => e.agent))) existingAgentSet.add(agent);

  if (existingAgentSet.size > agentLimit) {
    return c.json({
      error: 'Forbidden', message: `Agent limit reached (${agentLimit}). Upgrade to sync more agents.`,
      upgradeRequired: true, currentPlan: planConfig.plan, limitKey: 'agentLimit',
      current: existingAgentSet.size, limit: agentLimit,
    }, 403);
  }

  const rows = withinWindow.map((e) => ({
    id: e.id, userId, orgId: orgId ?? null, sessionId: e.sessionId, agent: e.agent,
    type: e.type, risk: e.risk, path: e.path ?? null, summary: e.summary,
    secretsCount: e.secretsCount, createdAt: e.timestamp,
  }));

  await db.insert(agentActivity).values(rows).onConflictDoNothing();

  let violations = 0;
  if (orgId) {
    for (const e of withinWindow) {
      const v = await evaluateActivity(db, orgId, {
        id: e.id, userId, type: e.type, risk: e.risk,
        path: e.path ?? null, summary: e.summary, secretsCount: e.secretsCount,
      });
      violations += v.length;
    }
  }

  // Trigger asset discovery (non-blocking — errors are logged, not thrown)
  if (orgId && withinWindow.length > 0) {
    const firstEvent = withinWindow[0]!;
    const sessionId = firstEvent.sessionId;
    const agentName = firstEvent.agent;
    const activityRecords = withinWindow.map((e) => ({
      id: e.id, sessionId: e.sessionId, agent: e.agent,
      type: e.type, risk: e.risk, path: e.path ?? null,
      summary: e.summary, secretsCount: e.secretsCount,
    }));
    discoverAfterActivitySync(db, orgId, sessionId, agentName, activityRecords).catch(() => {});
  }

  return c.json({ synced: rows.length, violations }, 201);
});

// GET /api/agents/activity — paginated activity feed
agentMonitorRoutes.get('/activity', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10), 500);
  const since = c.req.query('since');

  const conditions = since
    ? [eq(agentActivity.userId, userId), gte(agentActivity.createdAt, since)]
    : [eq(agentActivity.userId, userId)];

  const events = await db.select().from(agentActivity)
    .where(and(...conditions)).orderBy(desc(agentActivity.createdAt)).limit(limit);

  return c.json({ events });
});

// GET /api/agents/activity/summary
agentMonitorRoutes.get('/activity/summary', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const events = await db.select().from(agentActivity)
    .where(eq(agentActivity.userId, userId)).orderBy(desc(agentActivity.createdAt)).limit(1000);

  const summary = { total: events.length, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 };
  for (const e of events) {
    (summary[e.risk as keyof typeof summary] as number)++;
    summary.secretsDetected += e.secretsCount;
  }
  return c.json({ summary });
});

// DELETE /api/agents/activity
agentMonitorRoutes.delete('/activity', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  await db.delete(agentActivity).where(eq(agentActivity.userId, userId));
  return c.json({ cleared: true });
});
