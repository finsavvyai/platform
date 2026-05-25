import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { encrypt } from '../utils/encryption.js';

const connectIntegrationSchema = z.object({
  integrationSlug: z.string().min(1),
  instanceId: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

const integrationRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

integrationRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List user's integration connections
integrationRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  const sanitized = connections.map(
    ({ configEncrypted, ...rest }) => rest,
  );

  return c.json({ connections: sanitized });
});

// Connect an integration
integrationRoutes.post('/', requirePermission('cloud.write'), async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const parsed = connectIntegrationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const { integrationSlug, instanceId, config } = parsed.data;

  const id = generateId();
  const encryptedConfig = config
    ? await encrypt(JSON.stringify(config), c.env.ENCRYPTION_KEY)
    : null;

  await db.insert(integrationConnections).values({
    id,
    userId,
    instanceId,
    integrationSlug,
    status: 'connected',
    configEncrypted: encryptedConfig,
    lastSyncAt: new Date().toISOString(),
  });

  return c.json(
    { connection: { id, integrationSlug, status: 'connected' } },
    201,
  );
});

// Disconnect integration
integrationRoutes.delete('/:id', requirePermission('cloud.write'), async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const connId = c.req.param('id');

  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, connId),
        eq(integrationConnections.userId, userId),
      ),
    );

  if (!conn) {
    return c.json({ error: 'Not found' }, 404);
  }

  await db
    .update(integrationConnections)
    .set({ status: 'disconnected' })
    .where(eq(integrationConnections.id, connId));

  return c.json({ success: true });
});

// Get events for a connection (with ownership check)
integrationRoutes.get('/:id/events', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const connId = c.req.param('id');

  // Verify the connection belongs to the authenticated user
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, connId),
        eq(integrationConnections.userId, userId),
      ),
    );

  if (!conn) {
    return c.json({ error: 'Not found' }, 404);
  }

  const events = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.connectionId, connId))
    .limit(50);

  return c.json({ events });
});

export { integrationRoutes };
