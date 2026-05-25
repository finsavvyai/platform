/**
 * Kill Chain Correlation Routes
 *
 * GET /api/kill-chain/rules - list all kill chain rules
 * GET /api/kill-chain/incidents - list unified incidents
 * POST /api/kill-chain/evaluate - manually trigger evaluation for an event
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission, resolveOrgContext } from '../middleware/rbac.js';
import {
  KILL_CHAIN_RULES,
  evaluateKillChain,
  type UnifiedIncident,
} from '../services/kill-chain.js';
import { evaluateKillChainSchema } from './validation/kill-chain.js';

const killChainRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

killChainRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** GET /kill-chain/rules — list all kill chain rules */
killChainRoutes.get('/rules', async (c) => {
  return c.json({
    rules: KILL_CHAIN_RULES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      severity: r.severity,
      timeWindowMinutes: r.timeWindowMinutes,
      stages: r.stages,
    })),
  });
});

/** GET /kill-chain/incidents — list unified incidents */
killChainRoutes.get('/incidents', requirePermission('alert.view'), async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');

  // In a real implementation, query killChainIncidents table
  // const incidents = await db.select().from(killChainIncidents)
  //   .where(orgId ? eq(killChainIncidents.orgId, orgId) : undefined)
  //   .orderBy(desc(killChainIncidents.createdAt))
  //   .limit(100);

  const incidents: UnifiedIncident[] = [];

  return c.json({
    incidents,
    total: incidents.length,
  });
});

/** POST /kill-chain/evaluate — manually trigger evaluation for an event */
killChainRoutes.post('/evaluate', requirePermission('alert.view'), async (c) => {
  const db = c.get('db');
  const parsed = evaluateKillChainSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const { eventId } = parsed.data;

  // In a real implementation, fetch the event from integrationEvents
  // const event = await db.select().from(integrationEvents).where(eq(integrationEvents.id, eventId));
  // if (!event) return c.json({ error: 'Not found' }, 404);

  // const incidents = await evaluateKillChain(db, event);

  const incidents: UnifiedIncident[] = [];

  return c.json({
    eventId,
    incidentsCreated: incidents.length,
    incidents,
  });
});

export { killChainRoutes };
