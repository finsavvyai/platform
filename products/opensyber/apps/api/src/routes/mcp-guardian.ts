/**
 * MCP Guardian Scanner Routes
 *
 * Security scanning for MCP server configurations.
 */
import { Hono } from 'hono';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { scanMCPConfig, type McpFinding } from '../services/mcp-guardian.js';
import { mcpScanSchema, mcpQuarantineSchema } from './validation/mcp-guardian.js';

export const mcpGuardianRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

mcpGuardianRoutes.use('*', dbMiddleware, authMiddleware);

interface McpServerRecord {
  id: string;
  userId: string;
  name: string;
  status: 'active' | 'quarantined';
  lastScanAt: string | null;
  findings: McpFinding[];
  quarantineReason: string | null;
}

/** KV-backed server store helpers */
function kvKey(userId: string, serverId?: string): string {
  return serverId
    ? `mcp-guardian:${userId}:servers:${serverId}`
    : `mcp-guardian:${userId}:servers`;
}

async function getServer(kv: KVNamespace, userId: string, serverId: string): Promise<McpServerRecord | null> {
  const raw = await kv.get(kvKey(userId, serverId));
  return raw ? (JSON.parse(raw) as McpServerRecord) : null;
}

async function putServer(kv: KVNamespace, record: McpServerRecord): Promise<void> {
  const indexKey = kvKey(record.userId);
  const rawIndex = await kv.get(indexKey);
  const ids: string[] = rawIndex ? (JSON.parse(rawIndex) as string[]) : [];
  if (!ids.includes(record.id)) ids.push(record.id);
  await kv.put(indexKey, JSON.stringify(ids));
  await kv.put(kvKey(record.userId, record.id), JSON.stringify(record));
}

async function listServers(kv: KVNamespace, userId: string): Promise<McpServerRecord[]> {
  const rawIndex = await kv.get(kvKey(userId));
  const ids: string[] = rawIndex ? (JSON.parse(rawIndex) as string[]) : [];
  const results: McpServerRecord[] = [];
  for (const id of ids) {
    const server = await getServer(kv, userId, id);
    if (server) results.push(server);
  }
  return results;
}

/** POST /scan — accept MCP config JSON, return findings */
mcpGuardianRoutes.post('/scan', async (c) => {
  const parsed = mcpScanSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const findings = scanMCPConfig(parsed.data);
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  const userId = c.get('userId');
  const serverId = generateId();
  const record: McpServerRecord = {
    id: serverId,
    userId,
    name: parsed.data.name,
    status: criticalCount > 0 ? 'quarantined' : 'active',
    lastScanAt: new Date().toISOString(),
    findings,
    quarantineReason: criticalCount > 0 ? 'Auto-quarantined: critical findings' : null,
  };
  await putServer(c.env.CACHE, record);

  return c.json({
    data: {
      serverId,
      findings,
      summary: {
        total: findings.length,
        critical: criticalCount,
        high: highCount,
        medium: findings.filter((f) => f.severity === 'medium').length,
        autoQuarantined: criticalCount > 0,
      },
    },
  });
});

/** GET /servers — list registered MCP servers */
mcpGuardianRoutes.get('/servers', async (c) => {
  const userId = c.get('userId');
  const servers = (await listServers(c.env.CACHE, userId)).map(({ findings, ...rest }) => ({
    ...rest,
    findingCount: findings.length,
  }));

  return c.json({ data: servers });
});

/** POST /servers/:id/quarantine — quarantine server */
mcpGuardianRoutes.post('/servers/:id/quarantine', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const server = await getServer(c.env.CACHE, userId, id);

  if (!server) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const parsed = mcpQuarantineSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  server.status = 'quarantined';
  server.quarantineReason = parsed.data.reason;
  await putServer(c.env.CACHE, server);

  return c.json({
    data: { id: server.id, status: server.status, reason: server.quarantineReason },
  });
});
