/**
 * SDLC.cc DLP Webhook Receiver
 *
 * POST /api/integrations/sdlc/violations
 * Receives DLP violations from sdlc-platform DLP service (Presidio + regex +
 * BERT classifier + rule engine). Stores them in integration_events for
 * the unified findings feed. Excerpts must be redacted by the sender — never
 * accept raw PII.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { dbMiddleware } from '../../middleware/db.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { withResilience } from '../../middleware/webhook-resilience.js';
import { timingSafeCompare } from '../../lib/timing-safe.js';

const sdlcWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

sdlcWebhookRoutes.use('*', dbMiddleware);

const violationSchema = z.object({
  violation_id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  entity_type: z.string(),
  rule_name: z.string().nullable(),
  redacted_excerpt: z.string().max(512),
  document_id: z.string().nullable(),
  document_path: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['presidio', 'regex', 'classifier', 'rule-engine']),
});

const payloadSchema = z.object({
  violations: z.array(violationSchema),
  scan_id: z.string(),
  scanned_at: z.string(),
  document_count: z.number().int().min(0),
  connection_name: z.string(),
});

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleSdlcWebhook(c: any): Promise<Response> {
  const db = c.get('db');
  const secret = (c.env as Record<string, string>).SDLC_WEBHOOK_SECRET;

  if (!secret) {
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const signature = c.req.header('X-SDLC-Signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const expected = 'sha256=' + (await hmacSha256Hex(secret, rawBody));

  if (!timingSafeCompare(signature, expected)) {
    console.error('SDLC webhook signature mismatch');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const payload = parsed.data;

  try {
    const [conn] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.integrationSlug, `sdlc:${payload.connection_name}`),
          eq(integrationConnections.status, 'connected'),
        ),
      )
      .limit(1);

    if (!conn) {
      return c.json(
        {
          error: 'Unknown connection',
          message: `No active SDLC connection registered for '${payload.connection_name}'`,
        },
        404,
      );
    }

    const inserted: string[] = [];
    for (const violation of payload.violations) {
      const findingId = generateId();

      const summary =
        `${violation.entity_type} detected (${violation.source})` +
        (violation.rule_name ? ` — ${violation.rule_name}` : '');

      await db.insert(integrationEvents).values({
        id: findingId,
        connectionId: conn.id,
        eventType: `sdlc.dlp.${violation.entity_type.toLowerCase()}`,
        severity: violation.severity,
        summary: summary.slice(0, 1024),
        rawPayload: JSON.stringify({
          ...violation,
          scanId: payload.scan_id,
          scannedAt: payload.scanned_at,
          documentCount: payload.document_count,
        }).slice(0, 4096),
        processedAt: payload.scanned_at,
        latencyMs: 0,
      });

      inserted.push(findingId);
    }

    return c.json(
      {
        received: true,
        violationsProcessed: inserted.length,
        scanId: payload.scan_id,
      },
      202,
    );
  } catch (error) {
    console.error('SDLC webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

sdlcWebhookRoutes.use(
  '/violations',
  idempotencyMiddleware({
    source: 'sdlc',
    getEventType: (c) => `sdlc.${c.req.header('X-SDLC-Event') || 'violations'}`,
  }),
);

sdlcWebhookRoutes.post(
  '/violations',
  withResilience(handleSdlcWebhook, {
    source: 'sdlc',
    getEventType: (c) => `sdlc.${c.req.header('X-SDLC-Event') || 'violations'}`,
  }),
);

export { sdlcWebhookRoutes };
