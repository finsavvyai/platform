/**
 * MCP Monitoring Routes
 * List servers, track invocations, view alerts, trigger credential scans
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { trackMcpInvocation } from '../services/mcp-monitor.js';
import { trackInvocationSchema, scanServerSchema } from './validation/mcp-monitoring.js';

export const mcpMonitoringRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
mcpMonitoringRoutes.use('*', dbMiddleware, authMiddleware);

// GET / — list all MCP servers for user
mcpMonitoringRoutes.get('/', async (c) => {
  return c.json({ servers: [] });
});

// POST /invocations — track a tool invocation
mcpMonitoringRoutes.post('/invocations', async (c) => {
  const parsed = trackInvocationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);

  const result = await trackMcpInvocation(c.get('db'), c.env.CACHE, {
    agentId: parsed.data.agentId,
    serverId: parsed.data.serverId,
    toolName: parsed.data.toolName,
    duration: 0,
    timestamp: new Date().toISOString(),
    status: 'success',
  });

  return c.json({ data: result }, 201);
});

// GET /alerts — get recent MCP alerts
mcpMonitoringRoutes.get('/alerts', async (c) => {
  return c.json({ alerts: [] });
});

// POST /scan — trigger credential scan on server config
mcpMonitoringRoutes.post('/scan', async (c) => {
  const parsedScan = scanServerSchema.safeParse(await c.req.json());
  if (!parsedScan.success) return c.json({ error: 'Invalid input', details: parsedScan.error.issues[0]?.message }, 400);

  return c.json({
    data: {
      serverId: parsedScan.data.serverId,
      status: 'scanning',
      credentialRisks: [],
    },
  }, 202);
});
