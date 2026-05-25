/**
 * Per-tenant outgoing webhook configuration (multi-webhook).
 *
 * Auth via the tenantAuth middleware mounted on /v1/* — Bearer API key → tenantId.
 *
 *   GET    /v1/webhooks              — list all webhooks for the tenant
 *   POST   /v1/webhooks              — create a new webhook (secret revealed once)
 *   GET    /v1/webhooks/:id          — fetch one
 *   PATCH  /v1/webhooks/:id          — update url / events / enabled / name
 *   DELETE /v1/webhooks/:id          — delete a webhook
 *   POST   /v1/webhooks/:id/rotate   — rotate signing secret (revealed once)
 *
 * Secrets follow the same "shown once" UX as API keys: included in the
 * response body on creation / rotation, never again.
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { tfWebhookConfig } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { PLAN_WEBHOOK_LIMITS } from '../types.js';
import { logAudit } from '../services/audit-log.js';
import {
  createWebhookSchema,
  updateWebhookSchema,
  serializeWebhook,
  generateWebhookSecret,
} from '../services/webhooks/config-helpers.js';

export const webhookConfigRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── LIST ─────────────────────────────────────────────────────────────────────
webhookConfigRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const rows = await db
    .select()
    .from(tfWebhookConfig)
    .where(eq(tfWebhookConfig.tenantId, tenantId));
  return c.json({ data: rows.map(serializeWebhook) });
});

// ── CREATE ───────────────────────────────────────────────────────────────────
webhookConfigRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const plan = c.get('tenantPlan');

  let parsedBody: unknown;
  try {
    parsedBody = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Invalid JSON body' }, 400);
  }
  const parsed = createWebhookSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  // Enforce plan limit
  const limit = PLAN_WEBHOOK_LIMITS[plan] ?? PLAN_WEBHOOK_LIMITS['free']!;
  if (limit !== Infinity) {
    const existing = await db
      .select({ id: tfWebhookConfig.id })
      .from(tfWebhookConfig)
      .where(eq(tfWebhookConfig.tenantId, tenantId));
    if (existing.length >= limit) {
      return c.json(
        { error: 'plan_limit', message: `Your plan allows a maximum of ${limit} webhooks` },
        403,
      );
    }
  }

  const { endpointUrl, events, secret: providedSecret, name } = parsed.data;
  const effectiveSecret = providedSecret ?? generateWebhookSecret();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(tfWebhookConfig).values({
    id,
    tenantId,
    name: name ?? '',
    endpointUrl,
    events: events.join(','),
    secret: effectiveSecret,
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  });

  c.executionCtx.waitUntil(
    logAudit(c.env, 'webhook.created', tenantId, { webhookId: id, endpointUrl, events }),
  );

  return c.json(
    {
      data: {
        id,
        name: name ?? '',
        endpointUrl,
        events,
        enabled: true,
        lastDeliveryAt: null,
        lastDeliveryStatus: null,
        createdAt: now,
        updatedAt: now,
        // Revealed once at creation, never returned again.
        secret: effectiveSecret,
      },
    },
    201,
  );
});

// ── GET ONE ──────────────────────────────────────────────────────────────────
webhookConfigRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));
  if (!row) return c.json({ error: 'not_found', message: 'Webhook not found' }, 404);
  return c.json({ data: serializeWebhook(row) });
});

// ── UPDATE ───────────────────────────────────────────────────────────────────
webhookConfigRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  let parsedBody: unknown;
  try {
    parsedBody = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Invalid JSON body' }, 400);
  }
  const parsed = updateWebhookSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select()
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));
  if (!existing) return c.json({ error: 'not_found', message: 'Webhook not found' }, 404);

  const patch: Partial<typeof tfWebhookConfig.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.endpointUrl !== undefined) patch.endpointUrl = parsed.data.endpointUrl;
  if (parsed.data.events !== undefined) patch.events = parsed.data.events.join(',');
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled ? 1 : 0;

  await db
    .update(tfWebhookConfig)
    .set(patch)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));

  const [updated] = await db
    .select()
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));

  c.executionCtx.waitUntil(
    logAudit(c.env, 'webhook.updated', tenantId, { webhookId: id, patch: parsed.data }),
  );

  return c.json({ data: serializeWebhook(updated!) });
});

// ── DELETE ───────────────────────────────────────────────────────────────────
webhookConfigRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: tfWebhookConfig.id })
    .from(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));
  if (!existing) return c.json({ error: 'not_found', message: 'Webhook not found' }, 404);

  await db
    .delete(tfWebhookConfig)
    .where(and(eq(tfWebhookConfig.id, id), eq(tfWebhookConfig.tenantId, tenantId)));

  c.executionCtx.waitUntil(logAudit(c.env, 'webhook.deleted', tenantId, { webhookId: id }));

  return c.json({ data: { id, deleted: true } });
});

// Rotate, test delivery, and delivery log are mounted from webhooks-actions.ts
// to keep this file under the 200-line cap.
