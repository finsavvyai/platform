import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { cspmFindings } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { hasPermission } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';

export const cspmFindingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
cspmFindingRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

type Severity = 'critical' | 'high' | 'medium' | 'low';
type FindingStatus = 'open' | 'resolved' | 'muted';

const VALID_SEVERITIES = new Set<string>(['critical', 'high', 'medium', 'low']);
const VALID_STATUSES = new Set<string>(['open', 'resolved', 'muted']);

// GET /api/cloud/findings — list all org findings with filters
cspmFindingRoutes.get('/findings', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const severityFilter = c.req.query('severity');
  const statusFilter = c.req.query('status');
  const resourceTypeFilter = c.req.query('resourceType');

  // Build conditions
  const conditions = orgId
    ? [eq(cspmFindings.orgId, orgId)]
    : [eq(cspmFindings.cloudAccountId, userId)]; // solo fallback

  if (severityFilter && VALID_SEVERITIES.has(severityFilter)) {
    conditions.push(eq(cspmFindings.severity, severityFilter as Severity));
  }
  if (statusFilter && VALID_STATUSES.has(statusFilter)) {
    conditions.push(eq(cspmFindings.status, statusFilter as FindingStatus));
  }
  if (resourceTypeFilter && typeof resourceTypeFilter === 'string') {
    conditions.push(eq(cspmFindings.resourceType, resourceTypeFilter));
  }

  const findings = await db
    .select()
    .from(cspmFindings)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset);

  return c.json({ data: findings, hasMore: findings.length === limit });
});

// GET /api/cloud/findings/summary — aggregate counts
cspmFindingRoutes.get('/findings/summary', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const userId = c.get('userId');

  const condition = orgId
    ? eq(cspmFindings.orgId, orgId)
    : eq(cspmFindings.cloudAccountId, userId);

  const allFindings = await db
    .select()
    .from(cspmFindings)
    .where(condition)
    .limit(5000);

  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    open: 0,
    resolved: 0,
    muted: 0,
    total: allFindings.length,
  };

  for (const f of allFindings) {
    const sev = f.severity as keyof Pick<typeof summary, 'critical' | 'high' | 'medium' | 'low'>;
    if (sev in summary) summary[sev]++;

    const st = f.status as keyof Pick<typeof summary, 'open' | 'resolved' | 'muted'>;
    if (st in summary) summary[st]++;
  }

  return c.json({ data: summary });
});

// PATCH /api/cloud/findings/:id/mute — mute a finding
cspmFindingRoutes.patch('/findings/:id/mute', async (c) => {
  const role = c.get('role');
  if (role && !hasPermission(role, 'cloud.admin')) {
    return c.json({ error: 'Forbidden', message: 'cloud.admin required' }, 403);
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const findingId = c.req.param('id');

  const condition = orgId
    ? and(eq(cspmFindings.id, findingId), eq(cspmFindings.orgId, orgId))
    : eq(cspmFindings.id, findingId);

  const [finding] = await db.select().from(cspmFindings).where(condition);
  if (!finding) return c.json({ error: 'Not found', message: 'Finding not found' }, 404);

  const now = new Date().toISOString();
  await db
    .update(cspmFindings)
    .set({ status: 'muted', mutedAt: now, mutedBy: userId })
    .where(eq(cspmFindings.id, findingId));

  return c.json({ data: { id: findingId, status: 'muted', mutedAt: now, mutedBy: userId } });
});

// PATCH /api/cloud/findings/:id/resolve — resolve a finding
cspmFindingRoutes.patch('/findings/:id/resolve', async (c) => {
  const role = c.get('role');
  if (role && !hasPermission(role, 'cloud.write')) {
    return c.json({ error: 'Forbidden', message: 'cloud.write required' }, 403);
  }

  const db = c.get('db');
  const orgId = c.get('orgId');
  const findingId = c.req.param('id');

  const condition = orgId
    ? and(eq(cspmFindings.id, findingId), eq(cspmFindings.orgId, orgId))
    : eq(cspmFindings.id, findingId);

  const [finding] = await db.select().from(cspmFindings).where(condition);
  if (!finding) return c.json({ error: 'Not found', message: 'Finding not found' }, 404);

  const now = new Date().toISOString();
  await db
    .update(cspmFindings)
    .set({ status: 'resolved', resolvedAt: now })
    .where(eq(cspmFindings.id, findingId));

  return c.json({ data: { id: findingId, status: 'resolved', resolvedAt: now } });
});
