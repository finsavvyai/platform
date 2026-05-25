import { Hono } from 'hono';
import { eq, and, desc, lt } from 'drizzle-orm';
import { agentActivity } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { extensionSyncSchema } from './validation/agent-monitor.js';

export const agentMonitorSyncRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentMonitorSyncRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** Map extension event type to legacy type for backward compat */
function toLegacyType(eventType: string): 'file_read' | 'bash_exec' {
  if (eventType === 'terminal_command') return 'bash_exec';
  return 'file_read';
}

// POST /sync — receive activity events from OpenAgent extension
agentMonitorSyncRoutes.post('/sync', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const parsed = extensionSyncSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({
      error: 'Bad request',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    }, 400);
  }

  const { events } = parsed.data;
  if (events.length === 0) {
    return c.json({ synced: 0 });
  }

  const rows = events.map((e) => ({
    id: e.id,
    userId,
    orgId: orgId ?? null,
    sessionId: e.sessionId,
    agent: e.agentName,
    type: toLegacyType(e.eventType),
    risk: e.riskLevel,
    path: e.filePath ?? null,
    summary: e.summary ?? '',
    secretsCount: e.secretsDetected,
    agentName: e.agentName,
    eventType: e.eventType,
    riskLevel: e.riskLevel,
    filePath: e.filePath ?? null,
    secretsDetected: e.secretsDetected,
    metadata: e.metadata ?? null,
    createdAt: e.timestamp,
  }));

  await db.insert(agentActivity).values(rows).onConflictDoNothing();

  return c.json({ synced: rows.length });
});

// GET /summary — activity summary for dashboard
agentMonitorSyncRoutes.get('/summary', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const conditions = orgId
    ? [eq(agentActivity.userId, userId), eq(agentActivity.orgId, orgId)]
    : [eq(agentActivity.userId, userId)];

  const events = await db.select().from(agentActivity)
    .where(and(...conditions))
    .orderBy(desc(agentActivity.createdAt))
    .limit(1000);

  const riskBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
  const agentSet = new Set<string>();

  for (const e of events) {
    const level = (e.riskLevel ?? e.risk) as keyof typeof riskBreakdown;
    if (level in riskBreakdown) riskBreakdown[level]++;
    agentSet.add(e.agentName ?? e.agent);
  }

  const recentEvents = events.slice(0, 20).map(formatEvent);

  return c.json({
    totalEvents: events.length,
    riskBreakdown,
    agents: Array.from(agentSet),
    recentEvents,
  });
});

// GET /events — paginated event list with filters
agentMonitorSyncRoutes.get('/events', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const riskFilter = c.req.query('risk');
  const agentFilter = c.req.query('agent');
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);

  const conditions = orgId
    ? [eq(agentActivity.userId, userId), eq(agentActivity.orgId, orgId)]
    : [eq(agentActivity.userId, userId)];

  if (riskFilter) conditions.push(eq(agentActivity.riskLevel, riskFilter as typeof agentActivity.riskLevel.enumValues[number]));
  if (agentFilter) conditions.push(eq(agentActivity.agentName, agentFilter));
  if (cursor) conditions.push(lt(agentActivity.createdAt, cursor));

  const events = await db.select().from(agentActivity)
    .where(and(...conditions))
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit + 1);

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore && page.length > 0
    ? page[page.length - 1]!.createdAt
    : null;

  return c.json({
    data: page.map(formatEvent),
    nextCursor,
    hasMore,
  });
});

function formatEvent(e: typeof agentActivity.$inferSelect) {
  return {
    id: e.id,
    sessionId: e.sessionId,
    agentName: e.agentName ?? e.agent,
    eventType: e.eventType ?? (e.type === 'bash_exec' ? 'terminal_command' : 'file_access'),
    riskLevel: e.riskLevel ?? e.risk,
    filePath: e.filePath ?? e.path,
    summary: e.summary,
    secretsDetected: e.secretsDetected ?? e.secretsCount,
    metadata: e.metadata,
    createdAt: e.createdAt,
  };
}
