/**
 * Cloudflare Worker scheduled handler for CSPM scan scheduling
 * Runs every hour: cron(0 * * * *)
 */

import type { Env } from '../types.js';

export default {
  async scheduled(
    controller: { cron: string },
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const { cron } = controller;

    // Only process on hourly cron (every hour at :00)
    if (cron !== '0 * * * *') {
      return;
    }

    ctx.waitUntil(processCspmScans(env));
  },
};

/**
 * Process scheduled CSPM scans
 *
 * Finds cloud accounts with due scans and executes them.
 * Logs results for monitoring.
 */
async function processCspmScans(env: Env): Promise<void> {
  try {
    const { processScheduledScans } = await import('../services/cspm-scan-scheduler.js');
    const { createDb } = await import('../lib/db.js');

    const db = createDb(env.DB);
    const results = await processScheduledScans(db, { maxConcurrent: 5 });

    if (results.length > 0) {
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      console.log(
        `[CspmScanCron] Processed ${results.length} scheduled scans: ${successCount} succeeded, ${failCount} failed`,
      );

      // Log individual failures
      for (const result of results) {
        if (!result.success && result.error) {
          console.error(
            `[CspmScanCron] Account ${result.accountId} failed: ${result.error}`,
          );
        }
      }
    } else {
      console.log('[CspmScanCron] No scheduled scans due at this time');
    }
  } catch (error) {
    console.error('[CspmScanCron] Failed to process scheduled scans:', error);
  }
}
