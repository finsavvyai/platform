/**
 * Risk Snapshot Cron Job
 *
 * Scheduled Cloudflare Worker that runs daily at midnight UTC.
 * Captures risk snapshots for all active users and organizations.
 */

import { generateId } from '@opensyber/shared';
import type { Env } from '../types.js';

export interface CronResult {
  success: boolean;
  timestamp: string;
  userSnapshots: { success: number; failed: number; errors: string[] };
  orgSnapshots: { success: number; failed: number; errors: string[] };
  duration: number;
}

/**
 * Cloudflare Worker scheduled handler for risk snapshots
 * Runs daily at midnight UTC: cron(0 0 * * *)
 */
export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`[RiskSnapshot] Starting scheduled run at ${timestamp}`);

    try {
      // Import modules dynamically for Cloudflare Workers
      const { createDb } = await import('../lib/db.js');
      const {
        captureAllUserSnapshots,
        captureAllOrgSnapshots,
      } = await import('../services/risk-snapshotter.js');

      const db = createDb(env.DB);

      // Capture user snapshots
      console.log('[RiskSnapshot] Capturing user snapshots...');
      const userResults = await captureAllUserSnapshots(db);

      // Capture org snapshots
      console.log('[RiskSnapshot] Capturing org snapshots...');
      const orgResults = await captureAllOrgSnapshots(db);

      const duration = Date.now() - startTime;

      const result: CronResult = {
        success: true,
        timestamp,
        userSnapshots: userResults,
        orgSnapshots: orgResults,
        duration,
      };

      console.log('[RiskSnapshot] Completed:', JSON.stringify(result));

      // Store execution log (optional - could use a logging table or external service)
    } catch (error) {
      const duration = Date.now() - startTime;

      const result: CronResult = {
        success: false,
        timestamp,
        userSnapshots: { success: 0, failed: 0, errors: [] },
        orgSnapshots: { success: 0, failed: 0, errors: [] },
        duration,
      };

      console.error('[RiskSnapshot] Failed:', error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Manual trigger for testing (via HTTP endpoint)
 * Can be called from admin panel or monitoring
 */
export async function triggerRiskSnapshotManually(
  env: Env,
  userId?: string,
  orgId?: string,
): Promise<CronResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const { createDb } = await import('../lib/db.js');
    const {
      captureRiskSnapshot,
      captureAllUserSnapshots,
      captureAllOrgSnapshots,
    } = await import('../services/risk-snapshotter.js');

    const db = createDb(env.DB);

    if (userId || orgId) {
      // Single snapshot
      await captureRiskSnapshot(db, { userId, orgId });

      return {
        success: true,
        timestamp,
        userSnapshots: { success: userId ? 1 : 0, failed: 0, errors: [] },
        orgSnapshots: { success: orgId ? 1 : 0, failed: 0, errors: [] },
        duration: Date.now() - startTime,
      };
    }

    // All snapshots
    const userResults = await captureAllUserSnapshots(db);
    const orgResults = await captureAllOrgSnapshots(db);

    return {
      success: true,
      timestamp,
      userSnapshots: userResults,
      orgSnapshots: orgResults,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      timestamp,
      userSnapshots: { success: 0, failed: 0, errors: [String(error)] },
      orgSnapshots: { success: 0, failed: 0, errors: [] },
      duration: Date.now() - startTime,
    };
  }
}
