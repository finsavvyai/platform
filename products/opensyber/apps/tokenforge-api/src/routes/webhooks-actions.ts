/**
 * Webhook actions split out of webhooks-config.ts to stay under the file-size
 * cap. Same `/v1/webhooks/*` mount point, same auth — mounted alongside in
 * index.ts via `app.route('/v1/webhooks', webhookActionsRoutes)`.
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { tfWebhookConfig, tfWebhookDeliveries } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { logAudit } from '../services/audit-log.js';
import { dispatchWebhook } from '../services/webhook-dispatch.js';

const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `whsec_${hex}`;
}

export const webhookActionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── ROTATE SECRET ────────────────────────────────────────────────────────────
webhookActionsRoutes.post('/:id/rotate', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));
  if (!existing) return c.json({ error: 'not_found', message: 'Webhook not found' }, 404);

  const newSecret = generateSecret();
  const now = new Date();
  const graceEnd = existing.secret ? new Date(now.getTime() + GRACE_WINDOW_MS).toISOString() : null;
  await db
    .update(tfWebhookConfig)
    .set({
      secret: newSecret,
      secretPrevious: existing.secret ?? null,
      secretPreviousValidUntil: graceEnd,
      updatedAt: now.toISOString(),
    })
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));

  c.executionCtx.waitUntil(logAudit(c.env, 'webhook.secret_rotated', tenantId, { webhookId: id }));
  return c.json({ data: { id, secret: newSecret, gracePeriodEndsAt: graceEnd } });
});

// ── TEST DELIVERY ────────────────────────────────────────────────────────────
webhookActionsRoutes.post('/:id/test', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: tfWebhookConfig.id })
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));
  if (!existing) return c.json({ error: 'not_found', message: 'Webhook not found' }, 404);

  c.executionCtx.waitUntil(
    dispatchWebhook(db, tenantId, 'webhook.test', {
      message: 'This is a test delivery from the TokenForge dashboard.',
      webhookId: id,
    }),
  );
  return c.json({ data: { queued: true, message: 'Test delivery queued — check recent deliveries shortly.' } });
});

// ── DELIVERY LOG ─────────────────────────────────────────────────────────────
webhookActionsRoutes.get('/:id/deliveries', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const raw = parseInt(c.req.query('limit') ?? '25', 10) || 25;
  const limit = Math.max(1, Math.min(100, raw));

  const rows = await db
    .select()
    .from(tfWebhookDeliveries)
    .where(and(eq(tfWebhookDeliveries.webhookId, id), eq(tfWebhookDeliveries.tenantId, tenantId)))
    .orderBy(desc(tfWebhookDeliveries.scheduledAt))
    .limit(limit);

  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      event: r.event,
      attempt: r.attempt,
      status: r.status,
      error: r.error,
      scheduledAt: r.scheduledAt,
      deliveredAt: r.deliveredAt,
      nextRetryAt: r.nextRetryAt,
    })),
  });
});
