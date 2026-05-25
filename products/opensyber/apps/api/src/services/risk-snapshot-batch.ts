/**
 * Risk Snapshot Batch Capture
 *
 * Captures daily risk snapshots for all active users and organizations.
 * Used by scheduled cron jobs to build risk trend history.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { agentActivity, organizations } from '@opensyber/db';
import { gte } from 'drizzle-orm';
import { captureRiskSnapshot } from './risk-snapshotter.js';

type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

/**
 * Capture snapshots for all users with active agents
 */
export async function captureAllUserSnapshots(
  db: Db,
  snapshotDate?: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const date = snapshotDate || new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  // Get all users who have had agent activity in the past 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const activityRows = await db
    .select({ userId: agentActivity.userId })
    .from(agentActivity)
    .where(gte(agentActivity.createdAt, weekAgo));

  // Deduplicate user IDs
  const userIds = [...new Set(activityRows.map((r) => r.userId))];

  for (const userId of userIds) {
    try {
      await captureRiskSnapshot(db, { userId, snapshotDate: date });
      success++;
    } catch (error) {
      failed++;
      errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success, failed, errors };
}

/**
 * Capture snapshots for all organizations with active cloud accounts
 */
export async function captureAllOrgSnapshots(
  db: Db,
  snapshotDate?: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const date = snapshotDate || new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  // For now, get all organizations (in production, filter by active)
  const orgRows = await db
    .select({ id: organizations.id })
    .from(organizations);

  const orgIds = [...new Set(orgRows.map((r) => r.id))];

  for (const orgId of orgIds) {
    try {
      await captureRiskSnapshot(db, { orgId, snapshotDate: date });
      success++;
    } catch (error) {
      failed++;
      errors.push(`Org ${orgId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success, failed, errors };
}
