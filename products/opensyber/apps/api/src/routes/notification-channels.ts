import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { notificationChannels } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { createNotificationChannelSchema } from './validation/notification-channels.js';

const notificationChannelRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

notificationChannelRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List notification channels
notificationChannelRoutes.get('/user/notification-channels', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const channels = await db.select().from(notificationChannels)
    .where(eq(notificationChannels.userId, userId));

  return c.json({ channels });
});

// Create notification channel
notificationChannelRoutes.post('/user/notification-channels', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const parsed = createNotificationChannelSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const channel = {
    id: crypto.randomUUID(), userId,
    channelType: body.channelType as typeof notificationChannels.$inferInsert.channelType,
    name: body.name, config: body.config, isActive: true, createdAt: new Date().toISOString(),
  };

  await db.insert(notificationChannels).values(channel);
  return c.json({ channel }, 201);
});

// Delete notification channel
notificationChannelRoutes.delete('/user/notification-channels/:id', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const channelId = c.req.param('id');

  const [existing] = await db.select().from(notificationChannels)
    .where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.userId, userId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Notification channel not found' }, 404);

  await db.delete(notificationChannels).where(eq(notificationChannels.id, channelId));
  return c.json({ deleted: true });
});

export { notificationChannelRoutes };
