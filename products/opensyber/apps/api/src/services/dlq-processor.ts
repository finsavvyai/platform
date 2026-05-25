import type { Env } from '../types.js';
import { createDb } from '../lib/db.js';
import {
  fetchRetryableItems,
  markRetrying,
  purge,
} from './dead-letter-queue.js';

/**
 * Process retryable DLQ items during cron tick.
 * Fetches up to 10 pending items past their nextRetryAt
 * and bumps their retry count with exponential backoff.
 *
 * Actual reprocessing of the webhook payload is attempted inline.
 * If it fails again, the item is scheduled for the next backoff window.
 */
export async function processDlqRetries(env: Env): Promise<void> {
  const db = createDb(env.DB);

  try {
    const items = await fetchRetryableItems(db, 10);

    if (items.length === 0) return;

    console.log(`[DLQ] Processing ${items.length} retryable items`);

    for (const item of items) {
      try {
        // Attempt to reprocess the webhook payload
        await reprocessWebhook(env, item);

        // If successful, mark as resolved
        const { resolve } = await import('./dead-letter-queue.js');
        await resolve(db, item.id);
        console.log(`[DLQ] Successfully reprocessed item ${item.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[DLQ] Retry failed for ${item.id}: ${msg}`);
        await markRetrying(db, item.id, item.retryCount, item.maxRetries);
      }
    }

    // Purge resolved items older than 7 days
    const purged = await purge(db, 7);
    if (purged > 0) {
      console.log(`[DLQ] Purged ${purged} resolved items older than 7 days`);
    }
  } catch (error) {
    console.error('[DLQ] Cron processing failed:', error);
  }
}

/**
 * Attempt to reprocess a DLQ item by replaying its payload
 * against the appropriate webhook handler.
 */
async function reprocessWebhook(
  env: Env,
  item: {
    id: string;
    source: string;
    eventType: string;
    payload: string;
  },
): Promise<void> {
  // Build a synthetic request to the webhook endpoint. Reject any item
  // whose source is not an explicit allowlist entry.
  const path = resolveWebhookPath(item.source);
  if (!path) {
    throw new Error(`Refusing DLQ retry for unknown source: ${item.source}`);
  }
  const baseUrl = env.API_BASE_URL ?? 'https://api.opensyber.cloud';
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DLQ-Retry': item.id,
    },
    body: item.payload,
  });

  if (!response.ok) {
    throw new Error(
      `Reprocess failed with status ${response.status}: ${await response.text()}`,
    );
  }
}

/**
 * Map a DLQ source to its webhook endpoint path.
 *
 * Only known sources are allowed — falling back to an attacker-controlled
 * path lets anyone who can write a row to `dead_letter_queue` pivot the
 * retry into an arbitrary internal endpoint (SSRF primitive).
 */
const ALLOWED_DLQ_SOURCES: Record<string, string> = {
  github: '/webhooks/integrations/github',
  gitlab: '/webhooks/integrations/gitlab',
  pipewarden: '/api/integrations/pipewarden',
};

function resolveWebhookPath(source: string): string | null {
  return ALLOWED_DLQ_SOURCES[source] ?? null;
}
