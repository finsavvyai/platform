import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { deadLetterQueue } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { dbMiddleware } from '../middleware/db.js';
import {
  resolve,
  purge,
  getStats,
  fetchRetryableItems,
  markRetrying,
} from '../services/dead-letter-queue.js';

const dlqRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dlqRoutes.use('*', dbMiddleware);
dlqRoutes.use('*', authMiddleware);
dlqRoutes.use('*', adminMiddleware);

const dlqQuerySchema = z.object({
  status: z.enum(['pending', 'retrying', 'failed', 'resolved']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/** GET /api/dlq — List DLQ items with optional status filter */
dlqRoutes.get('/', async (c) => {
  const db = c.get('db');
  const query = dlqQuerySchema.parse(c.req.query());

  let q = db
    .select()
    .from(deadLetterQueue)
    .orderBy(desc(deadLetterQueue.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  if (query.status) {
    q = q.where(eq(deadLetterQueue.status, query.status)) as typeof q;
  }

  const items = await q;
  const stats = await getStats(db);

  return c.json({ data: { items, stats } });
});

/** POST /api/dlq/:id/retry — Manually retry a DLQ item */
dlqRoutes.post('/:id/retry', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [item] = await db
    .select()
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.id, id))
    .limit(1);

  if (!item) {
    return c.json({ error: 'Not found', message: 'DLQ item not found' }, 404);
  }

  if (item.status === 'resolved') {
    return c.json(
      { error: 'Bad request', message: 'Item already resolved' },
      400,
    );
  }

  // Reset for retry: set status back to pending with immediate nextRetryAt
  await db
    .update(deadLetterQueue)
    .set({
      status: 'pending',
      nextRetryAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
    })
    .where(eq(deadLetterQueue.id, id));

  return c.json({ data: { id, status: 'queued_for_retry' } });
});

/** DELETE /api/dlq/:id — Resolve/discard a DLQ item */
dlqRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [item] = await db
    .select()
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.id, id))
    .limit(1);

  if (!item) {
    return c.json({ error: 'Not found', message: 'DLQ item not found' }, 404);
  }

  await resolve(db, id);
  return c.json({ data: { id, status: 'resolved' } });
});

/** GET /api/dlq/stats — DLQ statistics */
dlqRoutes.get('/stats', async (c) => {
  const db = c.get('db');
  const stats = await getStats(db);
  return c.json({ data: stats });
});

export { dlqRoutes };
