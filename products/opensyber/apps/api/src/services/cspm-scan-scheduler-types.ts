import type { DrizzleD1Database } from 'drizzle-orm/d1';

export type Db = DrizzleD1Database<Record<string, unknown>>;

export type ScanSchedule = 'manual' | 'daily' | 'weekly';

/**
 * Result of processing a scheduled scan
 */
export interface ScheduledScanResult {
  accountId: string;
  success: boolean;
  scanRunId?: string;
  error?: string;
  nextScanAt?: string;
}

/**
 * Calculate the next scan time based on schedule
 */
export function calculateNextScanTime(
  schedule: ScanSchedule,
  lastScanAt?: string | null,
): string | null {
  if (schedule === 'manual') {
    return null;
  }

  const baseTime = lastScanAt ? new Date(lastScanAt) : new Date();

  switch (schedule) {
    case 'daily':
      const nextDaily = new Date(baseTime);
      nextDaily.setDate(nextDaily.getDate() + 1);
      return nextDaily.toISOString();

    case 'weekly':
      const nextWeekly = new Date(baseTime);
      nextWeekly.setDate(nextWeekly.getDate() + 7);
      return nextWeekly.toISOString();

    default:
      return null;
  }
}
