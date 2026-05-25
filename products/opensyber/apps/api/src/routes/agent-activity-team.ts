import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { agentActivity, cspmFindings } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../middleware/plan-enforcement.js';
import {
  computeCombinedRiskScore,
  type AgentSummary,
  type CspmSummary,
} from '../services/combined-risk-score.js';

export const agentTeamRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentTeamRoutes.use('*', dbMiddleware, authMiddleware, loadPlanConfig, requirePlanFeature('teamDashboard'), requirePermission('agent.policy.read'));

// GET /api/agents/team/activity — all activity across org
agentTeamRoutes.get('/team/activity', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.orgId, orgId))
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: events, hasMore: events.length === limit });
});

// GET /api/agents/team/summary — aggregate risk summary
agentTeamRoutes.get('/team/summary', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.orgId, orgId))
    .limit(5000);

  const uniqueUsers = new Set<string>();
  const summary = {
    total: events.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    secretsDetected: 0,
    uniqueUsers: 0,
  };

  for (const e of events) {
    const key = e.risk as keyof Pick<typeof summary, 'critical' | 'high' | 'medium' | 'low'>;
    if (key in summary) (summary[key] as number)++;
    summary.secretsDetected += e.secretsCount;
    uniqueUsers.add(e.userId);
  }
  summary.uniqueUsers = uniqueUsers.size;

  return c.json({ data: summary });
});

// GET /api/agents/team/members — per-member stats
agentTeamRoutes.get('/team/members', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.orgId, orgId))
    .limit(5000);

  const memberMap = new Map<string, {
    userId: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    secretsDetected: number;
  }>();

  for (const e of events) {
    let member = memberMap.get(e.userId);
    if (!member) {
      member = { userId: e.userId, total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 };
      memberMap.set(e.userId, member);
    }
    member.total++;
    const key = e.risk as 'critical' | 'high' | 'medium' | 'low';
    if (key in member) member[key]++;
    member.secretsDetected += e.secretsCount;
  }

  return c.json({ data: Array.from(memberMap.values()) });
});

// GET /api/agents/team/risk-score — combined org risk
agentTeamRoutes.get('/team/risk-score', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for team view' }, 400);
  }

  // Agent summary
  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.orgId, orgId))
    .limit(5000);

  const agent: AgentSummary = { total: events.length, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 };
  for (const e of events) {
    const key = e.risk as keyof Pick<AgentSummary, 'critical' | 'high' | 'medium' | 'low'>;
    if (key in agent) agent[key]++;
    agent.secretsDetected += e.secretsCount;
  }

  // CSPM summary
  const findings = await db
    .select()
    .from(cspmFindings)
    .where(and(eq(cspmFindings.orgId, orgId), eq(cspmFindings.status, 'open')))
    .limit(5000);

  const cspm: CspmSummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const key = f.severity as keyof CspmSummary;
    if (key in cspm) cspm[key]++;
  }

  const score = computeCombinedRiskScore(agent, cspm);
  return c.json({ data: score });
});
