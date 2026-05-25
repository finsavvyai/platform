/**
 * Webhook Delivery Log Routes
 *
 * Endpoints for viewing and retrying outbound webhook deliveries.
 *
 *   GET  /webhooks/logs       — list delivery attempts
 *   GET  /webhooks/logs/:id   — delivery detail
 *   POST /webhooks/logs/:id/retry — retry failed delivery
 */
import { Hono } from 'hono';
import { desc, eq, and } from 'drizzle-orm';
import { webhookDeliveryLogs } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { parseLimit } from '../utils/pagination.js';

type AppEnv = { Bindings: Env; Variables: Variables };

const webhookLogRoutes = new Hono<AppEnv>();

webhookLogRoutes.use('*', dbMiddleware, authMiddleware, requirePermission('audit.view'));

/** GET /webhooks/logs — list webhook delivery attempts */
webhookLogRoutes.get('/logs', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const limit = parseLimit(c.req.query('limit'));
  const status = c.req.query('status');

  const conditions = orgId ? [eq(webhookDeliveryLogs.orgId, orgId)] : [];
  if (status) {
    conditions.push(eq(webhookDeliveryLogs.status, status as typeof webhookDeliveryLogs.status.enumValues[number]));
  }

  const query = conditions.length > 0
    ? db.select({
        id: webhookDeliveryLogs.id,
        webhookUrl: webhookDeliveryLogs.webhookUrl,
        eventType: webhookDeliveryLogs.eventType,
        status: webhookDeliveryLogs.status,
        statusCode: webhookDeliveryLogs.statusCode,
        attemptCount: webhookDeliveryLogs.attemptCount,
        maxAttempts: webhookDeliveryLogs.maxAttempts,
        errorMessage: webhookDeliveryLogs.errorMessage,
        deliveredAt: webhookDeliveryLogs.deliveredAt,
        createdAt: webhookDeliveryLogs.createdAt,
      }).from(webhookDeliveryLogs).where(and(...conditions))
    : db.select({
        id: webhookDeliveryLogs.id,
        webhookUrl: webhookDeliveryLogs.webhookUrl,
        eventType: webhookDeliveryLogs.eventType,
        status: webhookDeliveryLogs.status,
        statusCode: webhookDeliveryLogs.statusCode,
        attemptCount: webhookDeliveryLogs.attemptCount,
        maxAttempts: webhookDeliveryLogs.maxAttempts,
        errorMessage: webhookDeliveryLogs.errorMessage,
        deliveredAt: webhookDeliveryLogs.deliveredAt,
        createdAt: webhookDeliveryLogs.createdAt,
      }).from(webhookDeliveryLogs);

  const rows = await query
    .orderBy(desc(webhookDeliveryLogs.createdAt))
    .limit(limit);

  return c.json({ data: rows });
});

/** GET /webhooks/logs/:id — delivery detail (full request/response) */
webhookLogRoutes.get('/logs/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const orgId = c.get('orgId');

  const conditions = [eq(webhookDeliveryLogs.id, id)];
  if (orgId) conditions.push(eq(webhookDeliveryLogs.orgId, orgId));

  const [log] = await db.select().from(webhookDeliveryLogs)
    .where(and(...conditions))
    .limit(1);

  if (!log) {
    return c.json({ error: 'Not Found', message: 'Webhook delivery log not found' }, 404);
  }

  return c.json({ data: log });
});

/** POST /webhooks/logs/:id/retry — retry a failed delivery */
webhookLogRoutes.post('/logs/:id/retry', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const orgId = c.get('orgId');

  const conditions = [eq(webhookDeliveryLogs.id, id)];
  if (orgId) conditions.push(eq(webhookDeliveryLogs.orgId, orgId));

  const [log] = await db.select().from(webhookDeliveryLogs)
    .where(and(...conditions))
    .limit(1);

  if (!log) {
    return c.json({ error: 'Not Found', message: 'Webhook delivery log not found' }, 404);
  }

  if (log.status === 'delivered') {
    return c.json({ error: 'Bad Request', message: 'Webhook already delivered' }, 400);
  }

  const url = new URL(log.webhookUrl);
  if (url.protocol !== 'https:' || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(url.hostname)) {
    return c.json({ error: 'Forbidden', message: 'Webhook URL not allowed' }, 403);
  }

  try {
    const resp = await fetch(log.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: log.payload,
    });

    const responseBody = await resp.text().catch(() => '');
    const now = new Date().toISOString();
    const newStatus = resp.ok ? 'delivered' : 'failed';

    await db.update(webhookDeliveryLogs)
      .set({
        status: newStatus,
        statusCode: resp.status,
        responseBody: responseBody.slice(0, 4096),
        attemptCount: (log.attemptCount ?? 1) + 1,
        deliveredAt: resp.ok ? now : null,
        errorMessage: resp.ok ? null : `HTTP ${resp.status}`,
        updatedAt: now,
      })
      .where(eq(webhookDeliveryLogs.id, id));

    return c.json({
      data: {
        id,
        status: newStatus,
        statusCode: resp.status,
        attemptCount: (log.attemptCount ?? 1) + 1,
      },
    });
  } catch (err) {
    const now = new Date().toISOString();
    const message = err instanceof Error ? err.message : 'Unknown error';

    await db.update(webhookDeliveryLogs)
      .set({
        status: 'failed',
        attemptCount: (log.attemptCount ?? 1) + 1,
        errorMessage: message,
        updatedAt: now,
      })
      .where(eq(webhookDeliveryLogs.id, id));

    return c.json({
      data: { id, status: 'failed', error: message, attemptCount: (log.attemptCount ?? 1) + 1 },
    });
  }
});

export { webhookLogRoutes };
