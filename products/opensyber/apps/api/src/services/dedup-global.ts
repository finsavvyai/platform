import { eq } from 'drizzle-orm';
import { integrationEvents } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

const DEDUP_TTL_SECONDS = 2 * 3600; // 2 hours

/**
 * Compute composite dedup key based on integration source and payload.
 */
export function computeDedupKey(
  source: string,
  payload: Record<string, any>,
  headers?: Record<string, string>,
): string {
  let baseKey = '';

  switch (source) {
    case 'guardduty':
      baseKey = `guardduty:${payload.findingId ?? payload.id ?? ''}`;
      break;
    case 'cloudtrail':
      baseKey = `cloudtrail:${payload.eventId ?? payload.id ?? ''}`;
      break;
    case 'github':
      baseKey = `github-delivery:${headers?.['x-github-delivery'] ?? ''}`;
      break;
    case 'gitlab':
      baseKey = `gitlab-event:${headers?.['x-gitlab-event-id'] ?? payload.id ?? ''}`;
      break;
    case 'datadog':
      baseKey = `datadog:${payload.id ?? payload.alert?.id ?? ''}`;
      break;
    case 'splunk':
      baseKey = `splunk:${payload.sid ?? payload.event_id ?? ''}`;
      break;
    default:
      baseKey = `${source}:${JSON.stringify(payload).slice(0, 64)}`;
  }

  return baseKey;
}

/**
 * Check if dedup key exists in KV (indicating duplicate).
 */
export async function isDuplicate(
  kv: KVNamespace,
  key: string,
): Promise<boolean> {
  const cached = await kv.get(`dedup:${key}`);
  return !!cached;
}

/**
 * Mark a dedup key as processed in KV with TTL.
 */
export async function markProcessed(
  kv: KVNamespace,
  key: string,
): Promise<void> {
  await kv.put(`dedup:${key}`, JSON.stringify({ processedAt: new Date().toISOString() }), {
    expirationTtl: DEDUP_TTL_SECONDS,
  });
}

/**
 * Increment the dedup count for an existing event.
 */
export async function incrementDedupCount(
  db: DrizzleD1Database<any>,
  existingEventId: string,
): Promise<void> {
  // Query the event and increment a duplicateCount field if it exists
  // For now, store in rawPayload as metadata
  const [event] = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.id, existingEventId));

  if (event && event.rawPayload) {
    try {
      const payload = JSON.parse(event.rawPayload);
      payload.duplicateCount = (payload.duplicateCount ?? 1) + 1;

      await db
        .update(integrationEvents)
        .set({ rawPayload: JSON.stringify(payload) })
        .where(eq(integrationEvents.id, existingEventId));
    } catch {
      // If payload is not JSON, skip
    }
  }
}
