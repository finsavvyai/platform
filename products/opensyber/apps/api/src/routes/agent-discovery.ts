import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { agentDiscoveryRuns, discoveredAgents, discoveredAgentOwners, discoveredAgentRiskScores, discoveryProtectionLinks } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { listDiscoveryAgentsQuerySchema, protectDiscoveredAgentSchema, setAgentOwnerSchema, startDiscoveryRunSchema } from './validation/agent-discovery.js';

const agentDiscoveryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentDiscoveryRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

agentDiscoveryRoutes.post('/runs', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);
  const parsed = startDiscoveryRunSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.get('db').insert(agentDiscoveryRuns).values({
    id: runId,
    orgId,
    startedByUserId: c.get('userId'),
    status: 'running',
    sourceType: parsed.data.sourceType ?? 'manual',
    sourceRef: parsed.data.sourceRef ?? null,
    startedAt: now,
  });
  return c.json({ data: { id: runId, status: 'running', startedAt: now } }, 201);
});

agentDiscoveryRoutes.get('/agents', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);
  const query = listDiscoveryAgentsQuerySchema.safeParse(c.req.query());
  if (!query.success) return c.json({ error: 'Invalid query', details: query.error.issues[0]?.message }, 400);
  const filters = [eq(discoveredAgents.orgId, orgId)];
  if (query.data.status) filters.push(eq(discoveredAgents.status, query.data.status));
  if (query.data.sourceType) filters.push(eq(discoveredAgents.surfaceType, query.data.sourceType));
  const agents = await c.get('db').select().from(discoveredAgents).where(and(...filters)).orderBy(desc(discoveredAgents.lastSeenAt));
  const agentIds = agents.map((agent) => agent.id);
  if (agentIds.length === 0) return c.json({ data: [] });
  const [riskRows, ownerRows, protectRows] = await Promise.all([
    c.get('db')
      .select()
      .from(discoveredAgentRiskScores)
      .where(inArray(discoveredAgentRiskScores.agentId, agentIds))
      .orderBy(desc(discoveredAgentRiskScores.scoredAt)),
    c.get('db')
      .select()
      .from(discoveredAgentOwners)
      .where(inArray(discoveredAgentOwners.agentId, agentIds))
      .orderBy(desc(discoveredAgentOwners.mappedAt)),
    c.get('db')
      .select()
      .from(discoveryProtectionLinks)
      .where(inArray(discoveryProtectionLinks.agentId, agentIds))
      .orderBy(desc(discoveryProtectionLinks.protectedAt)),
  ]);
  const latestRiskByAgent = new Map<string, (typeof riskRows)[number]>();
  const latestOwnerByAgent = new Map<string, (typeof ownerRows)[number]>();
  const hasProtection = new Set<string>();
  for (const row of riskRows) if (!latestRiskByAgent.has(row.agentId)) latestRiskByAgent.set(row.agentId, row);
  for (const row of ownerRows) if (!latestOwnerByAgent.has(row.agentId)) latestOwnerByAgent.set(row.agentId, row);
  for (const row of protectRows) hasProtection.add(row.agentId);
  const data = agents
    .map((agent) => {
      const risk = latestRiskByAgent.get(agent.id);
      const owner = latestOwnerByAgent.get(agent.id);
      return {
        ...agent,
        riskScore: risk?.score ?? 0,
        riskSeverity: risk?.severity ?? 'low',
        factors: parseFactors(risk?.factorsJson),
        ownerUserId: owner?.ownerUserId ?? null,
        ownerTeamId: owner?.ownerTeamId ?? null,
        ownerSource: owner?.ownerSource ?? null,
        protected: hasProtection.has(agent.id),
      };
    })
    .filter((agent) => !query.data.severity || agent.riskSeverity === query.data.severity)
    .filter((agent) => !query.data.owner || agent.ownerUserId === query.data.owner || agent.ownerTeamId === query.data.owner);
  return c.json({ data });
});

agentDiscoveryRoutes.get('/agents/:agentId', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);
  const agentId = c.req.param('agentId');
  const [agent] = await c.get('db')
    .select()
    .from(discoveredAgents)
    .where(and(eq(discoveredAgents.id, agentId), eq(discoveredAgents.orgId, orgId)));
  if (!agent) return c.json({ error: 'Not found', message: 'Discovered agent not found' }, 404);
  const [risk, owner, protection] = await Promise.all([
    c.get('db').select().from(discoveredAgentRiskScores).where(eq(discoveredAgentRiskScores.agentId, agentId)).orderBy(desc(discoveredAgentRiskScores.scoredAt)).limit(1),
    c.get('db').select().from(discoveredAgentOwners).where(eq(discoveredAgentOwners.agentId, agentId)).orderBy(desc(discoveredAgentOwners.mappedAt)).limit(1),
    c.get('db').select().from(discoveryProtectionLinks).where(eq(discoveryProtectionLinks.agentId, agentId)).orderBy(desc(discoveryProtectionLinks.protectedAt)),
  ]);
  return c.json({
    data: {
      ...agent,
      risk: risk[0] ?? null,
      owner: owner[0] ?? null,
      protectionLinks: protection,
      factors: parseFactors(risk[0]?.factorsJson),
    },
  });
});

agentDiscoveryRoutes.patch('/agents/:agentId/owner', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);
  const parsed = setAgentOwnerSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const agentId = c.req.param('agentId');
  const [agent] = await c.get('db')
    .select({ id: discoveredAgents.id })
    .from(discoveredAgents)
    .where(and(eq(discoveredAgents.id, agentId), eq(discoveredAgents.orgId, orgId)));
  if (!agent) return c.json({ error: 'Not found', message: 'Discovered agent not found' }, 404);
  const now = new Date().toISOString();
  await c.get('db').insert(discoveredAgentOwners).values({
    id: crypto.randomUUID(),
    agentId,
    ownerUserId: parsed.data.ownerUserId ?? null,
    ownerTeamId: parsed.data.ownerTeamId ?? null,
    ownerSource: parsed.data.ownerSource,
    confidence: parsed.data.confidence,
    mappedAt: now,
  }).onConflictDoUpdate({
    target: discoveredAgentOwners.agentId,
    set: {
      ownerUserId: parsed.data.ownerUserId ?? null,
      ownerTeamId: parsed.data.ownerTeamId ?? null,
      ownerSource: parsed.data.ownerSource,
      confidence: parsed.data.confidence,
      mappedAt: now,
    },
  });
  return c.json({ data: { agentId, ...parsed.data, mappedAt: now } });
});

agentDiscoveryRoutes.post('/agents/:agentId/protect', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);
  const parsed = protectDiscoveredAgentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const agentId = c.req.param('agentId');
  const [agent] = await c.get('db')
    .select({ id: discoveredAgents.id })
    .from(discoveredAgents)
    .where(and(eq(discoveredAgents.id, agentId), eq(discoveredAgents.orgId, orgId)));
  if (!agent) return c.json({ error: 'Not found', message: 'Discovered agent not found' }, 404);
  const now = new Date().toISOString();
  const linkId = crypto.randomUUID();
  await c.get('db').insert(discoveryProtectionLinks).values({
    id: linkId,
    agentId,
    instanceId: parsed.data.instanceId ?? null,
    protectionMethod: parsed.data.protectionMethod,
    status: 'active',
    protectedAt: now,
  });
  await c.get('db').update(discoveredAgents).set({ status: 'protected', lastSeenAt: now }).where(eq(discoveredAgents.id, agentId));
  return c.json({ data: { id: linkId, agentId, protectedAt: now, protectionMethod: parsed.data.protectionMethod } }, 201);
});

function parseFactors(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}
export { agentDiscoveryRoutes };
