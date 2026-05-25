/**
 * TenantIQ Webhook Receiver
 *
 * POST /api/integrations/tenantiq/findings
 * Receives M365 alerts from tenantiq intel/remediation/compliance engines
 * via HMAC-SHA256 signed webhook. Stores them in integration_events for
 * the unified findings feed.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { generateId } from '@opensyber/shared';
import { mapTenantiqSeverity } from '@opensyber/shared';
import type { TenantiqSeverity } from '@opensyber/shared';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { dbMiddleware } from '../../middleware/db.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { withResilience } from '../../middleware/webhook-resilience.js';
import { timingSafeCompare } from '../../lib/timing-safe.js';

const tenantiqWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

tenantiqWebhookRoutes.use('*', dbMiddleware);

const alertSchema = z.object({
  rule_id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['security', 'optimization', 'compliance', 'operational']),
  title: z.string(),
  description: z.string(),
  business_impact: z.string().nullable(),
  recommended_action: z.string().nullable(),
  affected_resources_count: z.number().int().min(0),
  tenant_id: z.string(),
});

const payloadSchema = z.object({
  alerts: z.array(alertSchema),
  tenant_id: z.string(),
  evaluated_at: z.string(),
  source: z.enum(['intel-engine', 'remediation', 'compliance-scan', 'drift-detection']),
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

async function handleTenantiqWebhook(c: any): Promise<Response> {
  const db = c.get('db');
  const secret = (c.env as Record<string, string>).TENANTIQ_WEBHOOK_SECRET;

  if (!secret) {
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const signature = c.req.header('X-TenantIQ-Signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const rawBody = await c.req.text();
  const expected = 'sha256=' + (await hmacSha256Hex(secret, rawBody));

  if (!timingSafeCompare(signature, expected)) {
    console.error('TenantIQ webhook signature mismatch');
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
          eq(integrationConnections.integrationSlug, `tenantiq:${payload.connection_name}`),
          eq(integrationConnections.status, 'connected'),
        ),
      )
      .limit(1);

    if (!conn) {
      return c.json(
        {
          error: 'Unknown connection',
          message: `No active TenantIQ connection registered for '${payload.connection_name}'`,
        },
        404,
      );
    }

    const inserted: string[] = [];
    for (const alert of payload.alerts) {
      const findingId = generateId();
      const mappedSeverity = mapTenantiqSeverity(alert.severity as TenantiqSeverity);

      await db.insert(integrationEvents).values({
        id: findingId,
        connectionId: conn.id,
        eventType: `tenantiq.${payload.source}.${alert.category}`,
        severity: mappedSeverity,
        summary: alert.title.slice(0, 1024),
        rawPayload: JSON.stringify({
          ...alert,
          tenantId: payload.tenant_id,
          source: payload.source,
          evaluatedAt: payload.evaluated_at,
        }).slice(0, 4096),
        processedAt: payload.evaluated_at,
        latencyMs: 0,
      });

      inserted.push(findingId);
    }

    return c.json(
      {
        received: true,
        alertsProcessed: inserted.length,
        tenantId: payload.tenant_id,
        source: payload.source,
      },
      202,
    );
  } catch (error) {
    console.error('TenantIQ webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

tenantiqWebhookRoutes.use(
  '/findings',
  idempotencyMiddleware({
    source: 'tenantiq',
    getEventType: (c) => `tenantiq.${c.req.header('X-TenantIQ-Event') || 'findings'}`,
  }),
);

tenantiqWebhookRoutes.post(
  '/findings',
  withResilience(handleTenantiqWebhook, {
    source: 'tenantiq',
    getEventType: (c) => `tenantiq.${c.req.header('X-TenantIQ-Event') || 'findings'}`,
  }),
);

export { tenantiqWebhookRoutes };
