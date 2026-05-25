/**
 * `/v1/webhooks` CRUD + test fire.
 *
 * Phase 7 keeps the store in-process; Phase 7.1 will swap to D1 +
 * Cloudflare Queues. The dispatcher path is the same in both worlds —
 * the only change is who holds the row.
 */

import type { Context } from 'hono';
import { z } from 'zod';
import type { App } from '@tokenforge/db';
import type { WebhookEvent, WebhookStore } from '../services/webhooks/store.js';
import { deliverWebhook } from '../services/webhooks/dispatcher.js';

const createSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('https://'), 'must be https'),
  events: z.array(z.enum(['risk_signal', 'session_revoked', 'session_register', 'refresh_failed'])).min(1),
});

export type WebhookRouteDeps = {
  store: WebhookStore;
  fetchImpl?: typeof globalThis.fetch;
};

export async function handleListWebhooks(c: Context, deps: WebhookRouteDeps): Promise<Response> {
  const app = c.get('app') as App;
  const list = await deps.store.listForApp(app.id);
  return c.json({
    webhooks: list.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      created_at: w.createdAt.toISOString(),
    })),
  });
}

export async function handleCreateWebhook(c: Context, deps: WebhookRouteDeps): Promise<Response> {
  const body = await safeJson(c);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.flatten() }, 400);
  const app = c.get('app') as App;
  const w = await deps.store.insert({
    appId: app.id,
    url: parsed.data.url,
    events: parsed.data.events as WebhookEvent[],
  });
  // Secret returned ONCE on creation — same one-shot reveal pattern as API keys.
  return c.json({
    id: w.id,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    secret: w.secret,
    created_at: w.createdAt.toISOString(),
  });
}

export async function handleDeleteWebhook(c: Context, deps: WebhookRouteDeps): Promise<Response> {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);
  const app = c.get('app') as App;
  const w = await deps.store.get(id);
  if (!w) return c.json({ error: 'webhook_unknown' }, 404);
  if (w.appId !== app.id) return c.json({ error: 'webhook_app_mismatch' }, 403);
  await deps.store.delete(id);
  return c.json({ ok: true });
}

export async function handleTestWebhook(c: Context, deps: WebhookRouteDeps): Promise<Response> {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);
  const app = c.get('app') as App;
  const w = await deps.store.get(id);
  if (!w) return c.json({ error: 'webhook_unknown' }, 404);
  if (w.appId !== app.id) return c.json({ error: 'webhook_app_mismatch' }, 403);
  const result = await deliverWebhook({
    url: w.url,
    secret: w.secret,
    event: 'test',
    body: { test: true, app_id: app.id, at: new Date().toISOString() },
    fetchImpl: deps.fetchImpl,
    attempts: 1,
  });
  return c.json({ ok: result.ok, status: result.status ?? null, attempts: result.attempts });
}

async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
