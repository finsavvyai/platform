/**
 * Webhook Retry Queue
 *
 * When an alert webhook delivery fails (Slack, PagerDuty, Discord, etc.),
 * enqueue it in the dead_letter_queue table for exponential-backoff retry.
 *
 * Retry schedule:
 *   - Attempt 1: immediate (in the dispatcher)
 *   - Attempt 2: +1 minute
 *   - Attempt 3: +5 minutes
 *   - Attempt 4: +30 minutes
 *   - After maxRetries: status = 'failed' (manual intervention)
 *
 * A scheduled cron (hourly) processes pending retries via processRetryQueue().
 */

import { eq, and, lte, inArray } from 'drizzle-orm';
import { deadLetterQueue } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] as const;
const MAX_RETRIES = RETRY_DELAYS_MS.length;

export interface WebhookPayload {
  channelId: string;
  channelType: string;
  webhookUrl: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Enqueue a failed webhook delivery for retry.
 */
export async function enqueueWebhookRetry(
  db: DrizzleD1Database<Record<string, unknown>>,
  payload: WebhookPayload,
  errorMessage: string,
): Promise<void> {
  const now = Date.now();
  const nextRetryAt = new Date(now + RETRY_DELAYS_MS[0]).toISOString();

  await db.insert(deadLetterQueue).values({
    id: crypto.randomUUID(),
    source: 'alerts',
    eventType: `webhook.${payload.channelType}`,
    payload: JSON.stringify(payload),
    errorMessage: errorMessage.slice(0, 500),
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    nextRetryAt,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
  });
}

/**
 * Process pending webhook retries. Called by hourly cron.
 * Returns { processed, succeeded, failed } counts.
 */
export async function processRetryQueue(
  db: DrizzleD1Database<Record<string, unknown>>,
  sendFn: (payload: WebhookPayload) => Promise<void>,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const nowIso = new Date().toISOString();

  const pending = await db
    .select()
    .from(deadLetterQueue)
    .where(
      and(
        eq(deadLetterQueue.source, 'alerts'),
        inArray(deadLetterQueue.status, ['pending', 'retrying']),
        lte(deadLetterQueue.nextRetryAt, nowIso),
      ),
    )
    .limit(50);

  let succeeded = 0;
  let failed = 0;

  for (const entry of pending) {
    const nextCount = entry.retryCount + 1;
    try {
      const payload = JSON.parse(entry.payload) as WebhookPayload;
      await sendFn(payload);

      await db
        .update(deadLetterQueue)
        .set({ status: 'resolved', lastAttemptAt: new Date().toISOString() })
        .where(eq(deadLetterQueue.id, entry.id));
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const exhausted = nextCount >= entry.maxRetries;
      const delayIdx = Math.min(nextCount, RETRY_DELAYS_MS.length - 1);
      const nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[delayIdx]!).toISOString();

      await db
        .update(deadLetterQueue)
        .set({
          status: exhausted ? 'failed' : 'retrying',
          retryCount: nextCount,
          nextRetryAt: exhausted ? null : nextRetryAt,
          errorMessage: msg.slice(0, 500),
          lastAttemptAt: new Date().toISOString(),
        })
        .where(eq(deadLetterQueue.id, entry.id));
      failed++;
    }
  }

  return { processed: pending.length, succeeded, failed };
}
