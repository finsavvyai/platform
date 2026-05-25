/**
 * Agent Registry Routes
 * List, register, and manage AI agents across all sources
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import {
  getAgentInventory,
  registerAgent,
  getAgentDetail,
  updateAgentRisk,
  assessAgentRisk,
  AGENT_SOURCES,
  AGENT_STATUS,
} from '../services/agent-registry.js';
import { registerAgentSchema, updateAgentRiskSchema } from './validation/agent-registry.js';

export const agentRegistryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentRegistryRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// GET / — list all agents for user
agentRegistryRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const agents = await getAgentInventory(c.get('db'), userId);

  return c.json({ data: agents });
});

// POST / — register an agent manually
agentRegistryRoutes.post('/', async (c) => {
  const parsed = registerAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const agent = await registerAgent(c.get('db'), {
    userId: c.get('userId'),
    name: body.name,
    source: body.source as any,
    owner: body.owner,
    permissions: body.permissions ?? [],
    riskScore: 0,
    status: 'active',
  });

  return c.json({ data: agent }, 201);
});

// GET /:id — get agent detail with risk profile
agentRegistryRoutes.get('/:id', async (c) => {
  const agentId = c.req.param('id');
  const agent = await getAgentDetail(c.get('db'), agentId);

  if (!agent) {
    return c.json({ error: 'Not found', message: 'Agent not found' }, 404);
  }

  const riskProfile = assessAgentRisk(agent);

  return c.json({
    data: {
      agent,
      riskProfile,
    },
  });
});

// PATCH /:id/risk — update risk score
agentRegistryRoutes.patch('/:id/risk', async (c) => {
  const agentId = c.req.param('id');
  const parsedRisk = updateAgentRiskSchema.safeParse(await c.req.json());
  if (!parsedRisk.success) return c.json({ error: 'Invalid input', details: parsedRisk.error.issues[0]?.message }, 400);

  await updateAgentRisk(c.get('db'), agentId, parsedRisk.data.riskScore);

  return c.json({ data: { agentId, newRiskScore: parsedRisk.data.riskScore } });
});
