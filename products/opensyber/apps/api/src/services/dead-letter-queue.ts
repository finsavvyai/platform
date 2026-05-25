import { eq, and, lt, sql, count } from 'drizzle-orm';
import { deadLetterQueue } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/** Exponential backoff delays: 1 min, 5 min, 30 min */
const BACKOFF_DELAYS_MS = [60_000, 300_000, 1_800_000];

export interface DlqEntry {
  source: string;
  eventType: string;
  payload: string;
  error: string;
}

/**
 * Insert a failed webhook event into the dead letter queue
 * with exponential backoff scheduling.
 */
export async function enqueue(
  db: DrizzleD1Database<any>,
  entry: DlqEntry,
): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();
  const nextRetryAt = new Date(Date.now() + (BACKOFF_DELAYS_MS[0] ?? 60_000)).toISOString();

  await db.insert(deadLetterQueue).values({
    id,
    source: entry.source,
    eventType: entry.eventType,
    payload: entry.payload,
    errorMessage: entry.error,
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt,
    status: 'pending',
    createdAt: now,
    lastAttemptAt: now,
  });

  return id;
}

/**
 * Fetch and process retryable DLQ items.
 * Returns items ready for retry; caller must handle reprocessing.
 */
export async function fetchRetryableItems(
  db: DrizzleD1Database<any>,
  limit = 10,
) {
  const now = new Date().toISOString();
  return db
    .select()
    .from(deadLetterQueue)
    .where(
      and(
        eq(deadLetterQueue.status, 'pending'),
        lt(deadLetterQueue.nextRetryAt, now),
      ),
    )
    .limit(limit);
}

/**
 * Mark a DLQ item as retrying and bump retry count with next backoff.
 */
export async function markRetrying(
  db: DrizzleD1Database<any>,
  id: string,
  retryCount: number,
  maxRetries: number,
): Promise<void> {
  const now = new Date().toISOString();
  const nextCount = retryCount + 1;

  if (nextCount >= maxRetries) {
    await db
      .update(deadLetterQueue)
      .set({ status: 'failed', retryCount: nextCount, lastAttemptAt: now })
      .where(eq(deadLetterQueue.id, id));
    return;
  }

  const delayMs = BACKOFF_DELAYS_MS[nextCount] ?? BACKOFF_DELAYS_MS[2] ?? 1_800_000;
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

  await db
    .update(deadLetterQueue)
    .set({
      status: 'pending',
      retryCount: nextCount,
      nextRetryAt,
      lastAttemptAt: now,
    })
    .where(eq(deadLetterQueue.id, id));
}

/**
 * Return DLQ statistics grouped by status.
 */
export async function getStats(db: DrizzleD1Database<any>) {
  const rows = await db
    .select({
      status: deadLetterQueue.status,
      total: count(),
    })
    .from(deadLetterQueue)
    .groupBy(deadLetterQueue.status);

  const stats: Record<string, number> = {
    pending: 0, retrying: 0, failed: 0, resolved: 0,
  };
  for (const row of rows) {
    if (row.status) stats[row.status] = row.total;
  }
  return stats;
}

/**
 * Mark a DLQ item as resolved.
 */
export async function resolve(
  db: DrizzleD1Database<any>,
  id: string,
): Promise<void> {
  await db
    .update(deadLetterQueue)
    .set({ status: 'resolved', lastAttemptAt: new Date().toISOString() })
    .where(eq(deadLetterQueue.id, id));
}

/**
 * Purge resolved items older than the given number of days.
 */
export async function purge(
  db: DrizzleD1Database<any>,
  olderThanDays: number,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const result = await db
    .delete(deadLetterQueue)
    .where(
      and(
        eq(deadLetterQueue.status, 'resolved'),
        lt(deadLetterQueue.createdAt, cutoff),
      ),
    );

  return (result as unknown as { changes?: number }).changes ?? 0;
}
