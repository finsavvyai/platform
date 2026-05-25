import { eq, sql } from 'drizzle-orm';
import { integrationConnections } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

interface SyncResult {
  success: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Records integration sync health data after a webhook is processed.
 * Updates connection-level counters and rolling average latency.
 *
 * @param db - Drizzle D1 database instance
 * @param connectionId - The integration connection ID
 * @param result - Sync outcome with timing and optional error
 */
export async function recordIntegrationSync(
  db: DrizzleD1Database<Record<string, unknown>>,
  connectionId: string,
  result: SyncResult,
): Promise<void> {
  const now = new Date().toISOString();

  if (result.success) {
    await db
      .update(integrationConnections)
      .set({
        lastSyncAt: now,
        eventsReceived: sql`${integrationConnections.eventsReceived} + 1`,
        consecutiveFailures: 0,
        avgLatencyMs: sql`CASE
          WHEN ${integrationConnections.eventsReceived} = 0 THEN ${result.latencyMs}
          ELSE (${integrationConnections.avgLatencyMs} * ${integrationConnections.eventsReceived} + ${result.latencyMs})
            / (${integrationConnections.eventsReceived} + 1)
          END`,
      })
      .where(eq(integrationConnections.id, connectionId));
  } else {
    await db
      .update(integrationConnections)
      .set({
        lastSyncAt: now,
        eventsReceived: sql`${integrationConnections.eventsReceived} + 1`,
        errorCount: sql`${integrationConnections.errorCount} + 1`,
        consecutiveFailures: sql`${integrationConnections.consecutiveFailures} + 1`,
        lastErrorAt: now,
        lastErrorMessage: result.error?.slice(0, 500) ?? 'Unknown error',
        avgLatencyMs: sql`CASE
          WHEN ${integrationConnections.eventsReceived} = 0 THEN ${result.latencyMs}
          ELSE (${integrationConnections.avgLatencyMs} * ${integrationConnections.eventsReceived} + ${result.latencyMs})
            / (${integrationConnections.eventsReceived} + 1)
          END`,
      })
      .where(eq(integrationConnections.id, connectionId));
  }
}
