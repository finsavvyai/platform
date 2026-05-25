/**
 * CSPM Scan Scheduler Service
 *
 * Schedules and processes periodic cloud security posture scans.
 * Supports manual, daily, and weekly scan schedules.
 */

import { eq, and, lte, ne } from 'drizzle-orm';
import { cloudAccounts } from '@opensyber/db';
import { runCspmScan } from './cspm-scanner.js';
import type { Db, ScanSchedule, ScheduledScanResult } from './cspm-scan-scheduler-types.js';
import { calculateNextScanTime } from './cspm-scan-scheduler-types.js';

// Re-export types for backward compatibility
export type { Db, ScanSchedule, ScheduledScanResult } from './cspm-scan-scheduler-types.js';
export { calculateNextScanTime } from './cspm-scan-scheduler-types.js';

/**
 * Update the next scan time for a cloud account
 */
export async function updateNextScanTime(
  db: Db,
  accountId: string,
  scanSchedule: ScanSchedule,
  lastScanAt?: string | null,
): Promise<void> {
  const nextScanAt = calculateNextScanTime(scanSchedule, lastScanAt);

  await db
    .update(cloudAccounts)
    .set({
      nextScanAt,
      lastScanAt: lastScanAt || new Date().toISOString(),
    })
    .where(eq(cloudAccounts.id, accountId));
}

/**
 * Process all scheduled scans that are due
 */
export async function processScheduledScans(
  db: Db,
  options: { maxConcurrent?: number; now?: string } = {},
): Promise<ScheduledScanResult[]> {
  const { maxConcurrent = 5, now = new Date().toISOString() } = options;

  const dueAccounts = await db
    .select()
    .from(cloudAccounts)
    .where(
      and(
        lte(cloudAccounts.nextScanAt, now),
        ne(cloudAccounts.scanSchedule, 'manual'),
        eq(cloudAccounts.status, 'active'),
      ),
    )
    .limit(maxConcurrent);

  if (dueAccounts.length === 0) return [];

  const results: ScheduledScanResult[] = [];

  for (const account of dueAccounts) {
    try {
      await db.update(cloudAccounts).set({ status: 'scanning' }).where(eq(cloudAccounts.id, account.id));

      const scanResult = await runCspmScan(db, account.id, account.orgId, account);

      if (scanResult.error) {
        await db.update(cloudAccounts).set({ status: 'error' }).where(eq(cloudAccounts.id, account.id));
        results.push({ accountId: account.id, success: false, error: scanResult.error });
        console.error(`[ScanScheduler] Scheduled scan failed for account ${account.id}: ${scanResult.error}`);
        continue;
      }

      const scanSchedule = account.scanSchedule as ScanSchedule;
      await updateNextScanTime(db, account.id, scanSchedule, now);
      await db.update(cloudAccounts).set({ status: 'active' }).where(eq(cloudAccounts.id, account.id));

      results.push({
        accountId: account.id,
        success: true,
        scanRunId: scanResult.scanRun.id,
        nextScanAt: calculateNextScanTime(scanSchedule, now) ?? undefined,
      });

      console.log(`[ScanScheduler] Scheduled scan completed for account ${account.id}: ${scanResult.scanRun.findingCount} findings`);
    } catch (error) {
      await db.update(cloudAccounts).set({ status: 'error' }).where(eq(cloudAccounts.id, account.id));
      results.push({ accountId: account.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      console.error(`[ScanScheduler] Unexpected error processing scan for account ${account.id}:`, error);
    }
  }

  return results;
}

/**
 * Schedule a one-time scan for a cloud account
 */
export async function scheduleImmediateScan(
  db: Db,
  accountId: string,
): Promise<void> {
  await db
    .update(cloudAccounts)
    .set({ nextScanAt: new Date().toISOString() })
    .where(eq(cloudAccounts.id, accountId));
}
