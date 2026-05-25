/**
 * Audit Webhook Sender — dispatch audit events to external webhooks
 *
 * Features:
 * - HMAC-SHA256 signature verification
 * - Retry logic with exponential backoff
 * - Non-blocking (never fails audit logging)
 * - Supports multiple webhooks per org
 */

import { createHmac } from 'crypto';

export interface AuditWebhookConfig {
  id: string;
  orgId: string;
  url: string;
  secret: string; // Stored as hash, but generated secret is provided once
  events: string[]; // Array of events to trigger on
  active: boolean;
  createdAt: Date;
}

export interface AuditWebhookPayload {
  id: string;
  action: string;
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
  orgId: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Send audit event to configured webhooks
 * Non-blocking — never fails request if webhook delivery fails
 */
export async function sendAuditWebhooks(
  env: any,
  orgId: string,
  payload: AuditWebhookPayload,
): Promise<void> {
  if (!env.DB) return;

  try {
    // Fetch webhooks for this org
    const webhooks = await env.DB.prepare(`
      SELECT id, url, secret, events
      FROM audit_webhooks
      WHERE org_id = ? AND active = 1
    `).bind(orgId).all();

    if (!webhooks.results?.length) return;

    const payloadJson = JSON.stringify(payload);

    // Fire all webhooks in parallel, but don't wait (background delivery)
    for (const webhook of webhooks.results) {
      // Check if this webhook should receive this event
      const events = webhook.events ? JSON.parse(webhook.events) : [];
      if (events.length > 0 && !events.includes(payload.action)) {
        continue;
      }

      // Queue webhook delivery
      deliverWebhookWithRetry(
        webhook.url,
        webhook.secret,
        payloadJson,
        orgId,
        webhook.id,
      ).catch((err) => {
        console.error(`Audit webhook delivery failed: ${webhook.url}`, err.message);
      });
    }
  } catch (err: any) {
    console.error('Audit webhook sender error:', err.message);
  }
}

/**
 * Deliver webhook with exponential backoff retry (up to 3 attempts)
 */
async function deliverWebhookWithRetry(
  url: string,
  secret: string,
  payload: string,
  orgId: string,
  webhookId: string,
  attempt = 1,
): Promise<void> {
  const maxAttempts = 3;

  try {
    const signature = generateWebhookSignature(payload, secret);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Luna-Signature': signature,
        'X-Luna-Webhook-ID': webhookId,
        'X-Luna-Org-ID': orgId,
      },
      body: payload,
    });

    if (!response.ok && attempt < maxAttempts) {
      // Retry on non-2xx response
      const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await deliverWebhookWithRetry(url, secret, payload, orgId, webhookId, attempt + 1);
    }
  } catch (err: any) {
    if (attempt < maxAttempts) {
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await deliverWebhookWithRetry(url, secret, payload, orgId, webhookId, attempt + 1);
    } else {
      throw err;
    }
  }
}

/**
 * Create audit webhook for an org
 */
export async function createAuditWebhook(
  db: D1Database,
  orgId: string,
  url: string,
  events: string[] = [],
): Promise<{ id: string; secret: string }> {
  const id = crypto.randomUUID();
  const secret = generateSecret();

  await db.prepare(`
    INSERT INTO audit_webhooks (id, org_id, url, secret, events, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).bind(
    id,
    orgId,
    url,
    hashSecret(secret),
    JSON.stringify(events),
    new Date().toISOString(),
  ).run();

  return { id, secret };
}

/**
 * List audit webhooks for org
 */
export async function listAuditWebhooks(db: D1Database, orgId: string) {
  const result = await db.prepare(`
    SELECT id, url, events, active, created_at
    FROM audit_webhooks
    WHERE org_id = ?
    ORDER BY created_at DESC
  `).bind(orgId).all();

  return (result.results || []).map((row: any) => ({
    ...row,
    events: row.events ? JSON.parse(row.events) : [],
  }));
}

/**
 * Delete audit webhook
 */
export async function deleteAuditWebhook(db: D1Database, webhookId: string) {
  await db.prepare(`
    DELETE FROM audit_webhooks WHERE id = ?
  `).bind(webhookId).run();
}

/**
 * Generate random secret for webhook
 */
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash secret for storage
 */
function hashSecret(secret: string): string {
  return createHmac('sha256', 'webhook-salt').update(secret).digest('hex');
}
