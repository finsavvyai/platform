import { eq, and, lt } from 'drizzle-orm';
import { incidents } from '@opensyber/db';
import type { Env } from '../types.js';
import { createDb } from '../lib/db.js';
import { processScheduledScans } from './cspm-scan-scheduler.js';
import { detectDrift } from './cspm-drift.js';
import { sendGatewayTokenRotationReminders, purgeExpiredActivity } from './cron-jobs.js';

/**
 * Runs all Sprint 10 + Sprint 24 + Sprint 29 scheduled jobs.
 * Called from the scheduled handler in index.ts.
 */
export async function runScheduledJobs(env: Env): Promise<void> {
  await Promise.allSettled([
    escalateStaleIncidents(env),
    sendGatewayTokenRotationReminders(env),
    captureRiskSnapshots(env),
    processCspmScheduledScansWithDrift(env),
    purgeExpiredActivity(env),
  ]);
}

/**
 * Auto-escalate incidents open > 24h with no acknowledgment.
 * Bumps severity: info -> warning -> critical.
 */
async function escalateStaleIncidents(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const staleIncidents = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.status, 'open'), lt(incidents.createdAt, cutoff)))
    .limit(50);

  const ESCALATION: Record<string, string> = {
    info: 'warning',
    warning: 'critical',
    critical: 'critical',
  };

  for (const incident of staleIncidents) {
    const newSeverity = ESCALATION[incident.severity] ?? 'critical';
    if (newSeverity !== incident.severity) {
      await db.update(incidents).set({
        severity: newSeverity as typeof incident.severity,
      }).where(eq(incidents.id, incident.id));
    }
  }
}

/**
 * Process scheduled CSPM scans with post-scan drift detection.
 * After each successful scan completes, runs drift detection to flag
 * new/resolved findings compared to the previous scan.
 */
async function processCspmScheduledScansWithDrift(env: Env): Promise<void> {
  try {
    const db = createDb(env.DB);
    const results = await processScheduledScans(db, { maxConcurrent: 5 });
    if (results.length === 0) return;

    const successCount = results.filter((r) => r.success).length;
    console.log(`[CronHandlers] Processed ${results.length} CSPM scans: ${successCount} succeeded`);

    // Run drift detection for each successfully scanned account
    for (const result of results) {
      if (!result.success) continue;
      try {
        const drift = await detectDrift(db, result.accountId);
        if (drift.newFindings.length > 0 || drift.resolvedFindings.length > 0) {
          console.log(
            `[CronHandlers] Drift detected for ${result.accountId}: ` +
            `${drift.newFindings.length} new, ${drift.resolvedFindings.length} resolved`,
          );
        }
      } catch (driftErr) {
        console.error(`[CronHandlers] Drift detection failed for ${result.accountId}:`, driftErr);
      }
    }
  } catch (error) {
    console.error('[CronHandlers] Failed to process CSPM scheduled scans:', error);
  }
}

/**
 * Capture risk snapshots for all users and orgs
 */
async function captureRiskSnapshots(env: Env): Promise<void> {
  try {
    const db = createDb(env.DB);
    const { captureAllUserSnapshots, captureAllOrgSnapshots } = await import('./risk-snapshotter.js');
    await captureAllUserSnapshots(db);
    await captureAllOrgSnapshots(db);
    console.log('[CronHandlers] Risk snapshots captured');
  } catch (error) {
    console.error('[CronHandlers] Failed to capture risk snapshots:', error);
  }
}
