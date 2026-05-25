/**
 * NHI (Non-Human Identity) Manager Routes
 *
 * CRUD for AI agent identities with risk scoring and orphan detection.
 */
import { Hono } from 'hono';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import {
  createNhiAgent, calculateRiskScore, isOrphaned, buildSummary,
  type NhiAgent,
} from '../services/nhi-manager.js';
import { createNhiAgentSchema, updateNhiAgentSchema } from './validation/nhi.js';

export const nhiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** In-memory store (replace with D1 table in production) */
const agentStore = new Map<string, NhiAgent>();

/** GET / — list all registered agent identities */
nhiRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const agents = [...agentStore.values()].filter((a) => a.ownerId === userId);
  return c.json({ data: agents });
});

/** GET /orphaned — list orphaned agents (must be before /:id) */
nhiRoutes.get('/orphaned', async (c) => {
  const userId = c.get('userId');
  const orphaned = [...agentStore.values()].filter(
    (a) => a.ownerId === userId && isOrphaned(a),
  );
  return c.json({ data: orphaned });
});

/** GET /summary — dashboard summary (must be before /:id) */
nhiRoutes.get('/summary', async (c) => {
  const userId = c.get('userId');
  const agents = [...agentStore.values()].filter((a) => a.ownerId === userId);
  return c.json({ data: buildSummary(agents) });
});

/** POST / — register new agent identity */
nhiRoutes.post('/', async (c) => {
  const parsed = createNhiAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const userId = c.get('userId');
  const agent = createNhiAgent({
    id: generateId(),
    name: parsed.data.name,
    type: parsed.data.type,
    ownerId: userId,
    metadata: parsed.data.metadata,
  });

  agentStore.set(agent.id, agent);
  return c.json({ data: agent }, 201);
});

/** PATCH /:id — update agent identity */
nhiRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const agent = agentStore.get(id);
  if (!agent || agent.ownerId !== c.get('userId')) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const parsed = updateNhiAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  if (parsed.data.name) agent.name = parsed.data.name;
  if (parsed.data.type) {
    agent.type = parsed.data.type;
    const risk = calculateRiskScore(agent);
    agent.riskScore = risk.score;
    agent.riskLevel = risk.level;
  }
  if (parsed.data.metadata) agent.metadata = parsed.data.metadata;

  return c.json({ data: agent });
});

/** POST /:id/suspend — suspend agent and revoke token */
nhiRoutes.post('/:id/suspend', async (c) => {
  const id = c.req.param('id');
  const agent = agentStore.get(id);
  if (!agent || agent.ownerId !== c.get('userId')) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  agent.status = 'suspended';
  agent.tokenHash = null;
  return c.json({ data: { id: agent.id, status: agent.status } });
});
