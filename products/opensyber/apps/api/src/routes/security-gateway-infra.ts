import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import {
  networkActivity, fileBaselines, fileIntegrityEvents, accessControlLog,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { networkActivitySchema, fileBaselinesSchema, fileEventsSchema, accessLogSchema } from './validation/security-gateway-infra.js';

const gatewaySecurityInfraRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

gatewaySecurityInfraRoutes.use('*', dbMiddleware, gatewayAuthMiddleware);

function verifyGatewayInstance(c: any): { instanceId: string } | null {
  const instanceId = c.req.param('instanceId');
  const headerInstanceId = c.req.header('X-Instance-Id');
  if (instanceId !== headerInstanceId) return null;
  return { instanceId };
}

// Agent reports network activity
gatewaySecurityInfraRoutes.post('/instances/:instanceId/network-activity', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsed = networkActivitySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);

  const now = new Date().toISOString();
  for (const a of parsed.data.activity) {
    await db.insert(networkActivity).values({
      id: crypto.randomUUID(),
      instanceId,
      domain: a.domain,
      method: a.method,
      path: a.path || null,
      statusCode: a.statusCode || null,
      action: (a.action === 'blocked' ? 'blocked' : 'allowed') as typeof networkActivity.$inferInsert.action,
      bytesTransferred: a.bytesTransferred || null,
      createdAt: now,
    });
  }

  return c.json({ received: parsed.data.activity.length }, 201);
});

// Agent reports file baselines
gatewaySecurityInfraRoutes.post('/instances/:instanceId/file-baselines', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsedBl = fileBaselinesSchema.safeParse(await c.req.json());
  if (!parsedBl.success) return c.json({ error: 'Invalid input', details: parsedBl.error.issues[0]?.message }, 400);

  const now = new Date().toISOString();
  for (const b of parsedBl.data.baselines) {
    await db.delete(fileBaselines).where(
      and(eq(fileBaselines.instanceId, instanceId), eq(fileBaselines.filePath, b.filePath)),
    );
    await db.insert(fileBaselines).values({
      id: crypto.randomUUID(),
      instanceId,
      filePath: b.filePath,
      sha256: b.sha256,
      permissions: b.permissions || null,
      size: b.size || null,
      lastVerified: now,
      createdAt: now,
    });
  }

  return c.json({ received: parsedBl.data.baselines.length }, 201);
});

// Agent reports file integrity events
gatewaySecurityInfraRoutes.post('/instances/:instanceId/file-events', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsedFe = fileEventsSchema.safeParse(await c.req.json());
  if (!parsedFe.success) return c.json({ error: 'Invalid input', details: parsedFe.error.issues[0]?.message }, 400);

  const validChangeTypes = new Set(['modified', 'created', 'deleted', 'permissions_changed']);
  const now = new Date().toISOString();

  for (const e of parsedFe.data.events) {
    await db.insert(fileIntegrityEvents).values({
      id: crypto.randomUUID(),
      instanceId,
      filePath: e.filePath,
      changeType: validChangeTypes.has(e.changeType)
        ? (e.changeType as typeof fileIntegrityEvents.$inferInsert.changeType)
        : 'modified',
      previousHash: e.previousHash || null,
      currentHash: e.currentHash || null,
      details: e.details || null,
      createdAt: now,
    });
  }

  return c.json({ received: parsedFe.data.events.length }, 201);
});

// Agent reports access control log
gatewaySecurityInfraRoutes.post('/instances/:instanceId/access-log', async (c) => {
  const db = c.get('db');
  const verified = verifyGatewayInstance(c);
  if (!verified) return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  const { instanceId } = verified;

  const parsedAl = accessLogSchema.safeParse(await c.req.json());
  if (!parsedAl.success) return c.json({ error: 'Invalid input', details: parsedAl.error.issues[0]?.message }, 400);

  const validAccessTypes = new Set(['api', 'ssh', 'console']);
  const now = new Date().toISOString();

  for (const e of parsedAl.data.entries) {
    await db.insert(accessControlLog).values({
      id: crypto.randomUUID(),
      instanceId,
      accessType: validAccessTypes.has(e.accessType)
        ? (e.accessType as typeof accessControlLog.$inferInsert.accessType)
        : 'api',
      sourceIp: e.sourceIp || null,
      sourceCountry: e.sourceCountry || null,
      action: (e.action === 'denied' ? 'denied' : 'allowed') as typeof accessControlLog.$inferInsert.action,
      details: e.details || null,
      createdAt: now,
    });
  }

  return c.json({ received: parsedAl.data.entries.length }, 201);
});

export { gatewaySecurityInfraRoutes };
