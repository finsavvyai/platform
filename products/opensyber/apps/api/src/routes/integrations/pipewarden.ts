/**
 * PipeWarden Webhook Receiver
 *
 * POST /api/integrations/pipewarden/findings
 * Receives PipeWarden findings via webhook and stores them in OpenSyber.
 * Maps PipeWarden severity to OpenSyber severity model and triggers real-time dashboard updates.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { mapPipeWardenSeverity } from '@opensyber/shared';
import type { PipeWardenSeverity } from '@opensyber/shared';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { dbMiddleware } from '../../middleware/db.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { withResilience } from '../../middleware/webhook-resilience.js';
import { timingSafeCompare } from '../../lib/timing-safe.js';

const pipewardenWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

pipewardenWebhookRoutes.use('*', dbMiddleware);

// Validation schema for incoming findings
const findingSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  remediation: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  confidence: z.number().min(0).max(1),
  connection_name: z.string(),
  run_id: z.string(),
});

const payloadSchema = z.object({
  findings: z.array(findingSchema),
  risk_score: z.number().min(0).max(100),
  summary: z.string(),
  connection_name: z.string(),
  analyzed_at: z.string(),
});

/** Compute HMAC-SHA256 hex digest for webhook signature verification */
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

async function handlePipeWardenWebhook(c: any): Promise<Response> {
  const db = c.get('db');
  const secret = (c.env as Record<string, string>).PIPEWARDEN_WEBHOOK_SECRET;

  if (!secret) {
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const signature = c.req.header('X-PipeWarden-Signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const expected = 'sha256=' + (await hmacSha256Hex(secret, rawBody));

  if (!timingSafeCompare(signature, expected)) {
    console.error('PipeWarden webhook signature mismatch');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const payload = parsed.data;

  try {
    // Resolve the OpenSyber integration connection this PipeWarden
    // instance owns. The webhook body identifies itself by `connection_name`
    // which the tenant configured at registration time. Without a match we
    // cannot attribute findings to any tenant, so reject the batch rather
    // than silently drop or attach to the wrong tenant.
    const [conn] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.integrationSlug, `pipewarden:${payload.connection_name}`),
          eq(integrationConnections.status, 'connected'),
        ),
      )
      .limit(1);

    if (!conn) {
      return c.json(
        {
          error: 'Unknown connection',
          message: `No active PipeWarden connection registered for '${payload.connection_name}'`,
        },
        404,
      );
    }

    const findingsInserted: string[] = [];
    for (const finding of payload.findings) {
      const findingId = generateId();
      const mappedSeverity = mapPipeWardenSeverity(finding.severity as PipeWardenSeverity);

      await db.insert(integrationEvents).values({
        id: findingId,
        connectionId: conn.id,
        eventType: `pipewarden.finding.${finding.category}`,
        severity: mappedSeverity,
        summary: finding.title.slice(0, 1024),
        rawPayload: JSON.stringify({
          ...finding,
          runId: finding.run_id,
          riskScore: payload.risk_score,
          analyzedAt: payload.analyzed_at,
        }).slice(0, 4096),
        processedAt: payload.analyzed_at,
        latencyMs: 0,
      });

      findingsInserted.push(findingId);
    }

    return c.json(
      {
        received: true,
        findingsProcessed: findingsInserted.length,
        riskScore: payload.risk_score,
      },
      202,
    );
  } catch (error) {
    console.error('PipeWarden webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

pipewardenWebhookRoutes.use(
  '/findings',
  idempotencyMiddleware({
    source: 'pipewarden',
    getEventType: (c) => `pipewarden.${c.req.header('X-PipeWarden-Event') || 'findings'}`,
  }),
);

pipewardenWebhookRoutes.post(
  '/findings',
  withResilience(handlePipeWardenWebhook, {
    source: 'pipewarden',
    getEventType: (c) => `pipewarden.${c.req.header('X-PipeWarden-Event') || 'findings'}`,
  }),
);

export { pipewardenWebhookRoutes };
