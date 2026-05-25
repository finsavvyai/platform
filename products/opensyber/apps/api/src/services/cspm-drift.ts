/**
 * CSPM Drift Detection
 *
 * Compares findings between consecutive scans to detect new, resolved, and unchanged findings.
 * Used to track security posture changes over time.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { cspmScanRuns, cspmFindings } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

export interface DriftResult {
  newFindings: string[];
  resolvedFindings: string[];
  unchangedCount: number;
  totalCurrent: number;
  totalPrevious: number;
}

export async function detectDrift(db: Db, cloudAccountId: string): Promise<DriftResult> {
  const recentScans = await db.select().from(cspmScanRuns)
    .where(and(eq(cspmScanRuns.cloudAccountId, cloudAccountId), eq(cspmScanRuns.status, 'completed')))
    .orderBy(desc(cspmScanRuns.completedAt))
    .limit(2);

  if (recentScans.length < 2) {
    return { newFindings: [], resolvedFindings: [], unchangedCount: 0, totalCurrent: 0, totalPrevious: 0 };
  }

  const currentScan = recentScans[0]!;
  const previousScan = recentScans[1]!;

  const currentFindings = await db.select({ checkId: cspmFindings.checkId, resourceId: cspmFindings.resourceId })
    .from(cspmFindings).where(eq(cspmFindings.scanRunId, currentScan.id));

  const previousFindings = await db.select({ checkId: cspmFindings.checkId, resourceId: cspmFindings.resourceId })
    .from(cspmFindings).where(eq(cspmFindings.scanRunId, previousScan.id));

  const currentKeys = new Set(currentFindings.map((f) => `${f.checkId}:${f.resourceId}`));
  const previousKeys = new Set(previousFindings.map((f) => `${f.checkId}:${f.resourceId}`));

  const newFindings = [...currentKeys].filter((k) => !previousKeys.has(k));
  const resolvedFindings = [...previousKeys].filter((k) => !currentKeys.has(k));
  const unchangedCount = [...currentKeys].filter((k) => previousKeys.has(k)).length;

  return {
    newFindings,
    resolvedFindings,
    unchangedCount,
    totalCurrent: currentFindings.length,
    totalPrevious: previousFindings.length,
  };
}
