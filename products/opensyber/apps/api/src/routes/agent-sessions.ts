import { Hono } from 'hono';
import { eq, and, desc, asc } from 'drizzle-orm';
import { agentActivity } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { loadPlanConfig } from '../middleware/plan-enforcement.js';

const agentSessionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply middleware
agentSessionRoutes.use('*', dbMiddleware, authMiddleware, loadPlanConfig);

interface SessionStats {
  sessionId: string;
  eventCount: number;
  riskBreakdown: { critical: number; high: number; medium: number; low: number };
  firstEvent: string;
  lastEvent: string;
  agent: string;
}

/**
 * GET /api/agents/activity/sessions
 * Returns distinct sessions with stats (event count, risk breakdown, time range)
 */
agentSessionRoutes.get('/activity/sessions', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  // Fetch all activity for the user (limited for performance)
  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.userId, userId))
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit + offset) // Fetch extra to calculate pagination correctly

  // Group events by session in application code
  const sessionMap = new Map<string, SessionStats>();

  for (const event of events) {
    const existing = sessionMap.get(event.sessionId);

    if (existing) {
      existing.eventCount++;
      existing.riskBreakdown[event.risk as keyof SessionStats['riskBreakdown']]++;
      if (event.createdAt < existing.firstEvent) {
        existing.firstEvent = event.createdAt;
      }
    } else {
      sessionMap.set(event.sessionId, {
        sessionId: event.sessionId,
        eventCount: 1,
        riskBreakdown: {
          critical: event.risk === 'critical' ? 1 : 0,
          high: event.risk === 'high' ? 1 : 0,
          medium: event.risk === 'medium' ? 1 : 0,
          low: event.risk === 'low' ? 1 : 0,
        },
        firstEvent: event.createdAt,
        lastEvent: event.createdAt,
        agent: event.agent,
      });
    }
  }

  // Convert to array and apply pagination
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => b.lastEvent.localeCompare(a.lastEvent))
    .slice(offset, offset + limit);

  return c.json({
    data: sessions,
    hasMore: sessionMap.size > offset + limit,
  });
});

/**
 * GET /api/agents/activity/sessions/:sessionId
 * Returns all events for a specific session, ordered by timestamp
 */
agentSessionRoutes.get('/activity/sessions/:sessionId', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');
  const db = c.get('db');

  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const events = await db
    .select()
    .from(agentActivity)
    .where(
      and(
        eq(agentActivity.userId, userId),
        eq(agentActivity.sessionId, sessionId),
      ),
    )
    .orderBy(asc(agentActivity.createdAt))
    .limit(limit)
    .offset(offset);

  // Verify the session belongs to the user
  if (events.length === 0 && offset === 0) {
    return c.json(
      { error: 'Not Found', message: 'Session not found or does not belong to you' },
      404,
    );
  }

  return c.json({
    data: events,
    hasMore: events.length === limit,
  });
});

export { agentSessionRoutes };
