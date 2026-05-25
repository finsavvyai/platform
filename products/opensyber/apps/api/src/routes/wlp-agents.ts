/**
 * OpenSyber Workload Protection — CRUD API for tf_wlp_agents + findings list.
 *
 * Each row in tf_wlp_agents represents one host running a WLP engine
 * (Falco / osquery / Wazuh). Findings are append-only events shipped by
 * the agent.
 *
 *   GET    /api/wlp/agents              list current owner's agents
 *   POST   /api/wlp/agents              register a new agent (heartbeat init)
 *   PATCH  /api/wlp/agents/:id          update version/tags/status/lastSeen
 *   DELETE /api/wlp/agents/:id          mark offline (status='offline')
 *   GET    /api/wlp/findings            paged findings, severity filter
 *
 * Mirrors apps/api/src/routes/dns-tenants.ts auth + zod validation pattern.
 */

import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { tfWlpAgents, tfWlpFindings } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';

export const wlpAgentRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
wlpAgentRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

const HOSTNAME_RE = /^[a-zA-Z0-9._-]{1,253}$/;

const createSchema = z.object({
  hostname: z.string().regex(HOSTNAME_RE, 'invalid hostname'),
  agentType: z.enum(['falco', 'osquery', 'wazuh']),
  version: z.string().min(1).max(64),
  tags: z.array(z.string().max(64)).max(32).optional(),
});

const updateSchema = z.object({
  version: z.string().min(1).max(64).optional(),
  status: z.enum(['active', 'stale', 'offline']).optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  lastSeenAt: z.string().datetime().optional(),
});

function ownerCondition(orgId: string | null, userId: string) {
  return orgId
    ? eq(tfWlpAgents.orgId, orgId)
    : eq(tfWlpAgents.ownerUserId, userId);
}

wlpAgentRoutes.get('/agents', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const rows = await db
    .select()
    .from(tfWlpAgents)
    .where(ownerCondition(orgId, userId));

  return c.json({ data: rows });
});

wlpAgentRoutes.post('/agents', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const id = generateId();
  const now = new Date().toISOString();
  await db.insert(tfWlpAgents).values({
    id,
    tenantId: orgId,
    ownerUserId: userId,
    orgId,
    hostname: parsed.data.hostname,
    agentType: parsed.data.agentType,
    version: parsed.data.version,
    lastSeenAt: now,
    status: 'active',
    tags: JSON.stringify(parsed.data.tags ?? []),
    createdAt: now,
  });

  return c.json({ data: { id, ...parsed.data, status: 'active' } }, 201);
});

wlpAgentRoutes.patch('/agents/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const [row] = await db
    .select({ id: tfWlpAgents.id })
    .from(tfWlpAgents)
    .where(and(eq(tfWlpAgents.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  const update: Record<string, unknown> = {};
  if (parsed.data.version !== undefined) update.version = parsed.data.version;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.tags !== undefined) update.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.lastSeenAt !== undefined) update.lastSeenAt = parsed.data.lastSeenAt;

  await db.update(tfWlpAgents).set(update).where(eq(tfWlpAgents.id, id));
  return c.json({ data: { id, ...parsed.data } });
});

wlpAgentRoutes.delete('/agents/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;
  const id = c.req.param('id');

  const [row] = await db
    .select({ id: tfWlpAgents.id })
    .from(tfWlpAgents)
    .where(and(eq(tfWlpAgents.id, id), ownerCondition(orgId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);

  await db
    .update(tfWlpAgents)
    .set({ status: 'offline' })
    .where(eq(tfWlpAgents.id, id));

  return c.json({ data: { id, status: 'offline' } });
});

const findingsQuerySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  agentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

wlpAgentRoutes.get('/findings', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId') ?? null;

  const parsed = findingsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: 'invalid_query', details: parsed.error.flatten() }, 400);
  }

  // Findings are scoped via the parent agent's owner; inner-join via id list.
  const ownedAgents = await db
    .select({ id: tfWlpAgents.id })
    .from(tfWlpAgents)
    .where(ownerCondition(orgId, userId));
  const ownedIds = new Set(ownedAgents.map((a) => a.id));
  if (ownedIds.size === 0) return c.json({ data: [] });

  const where = parsed.data.agentId
    ? eq(tfWlpFindings.agentId, parsed.data.agentId)
    : undefined;

  const rows = await db
    .select()
    .from(tfWlpFindings)
    .where(where)
    .orderBy(desc(tfWlpFindings.detectedAt))
    .limit(parsed.data.limit);

  const filtered = rows
    .filter((r) => ownedIds.has(r.agentId))
    .filter((r) => !parsed.data.severity || r.severity === parsed.data.severity);

  return c.json({ data: filtered });
});
