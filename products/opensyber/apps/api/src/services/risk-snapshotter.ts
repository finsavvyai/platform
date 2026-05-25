/**
 * Risk Snapshot Service -- captures daily risk snapshots for users and organizations.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { agentRiskSnapshots, agentActivity, cspmFindings } from '@opensyber/db';
import { eq, and, gte } from 'drizzle-orm';
import { computeAgentScore, computeCspmScore, type AgentSummary, type CspmSummary } from './combined-risk-score.js';

// Re-export for backward compatibility
export { getRiskTrend, type TrendDataPoint, type TrendOptions } from './risk-trend.js';
export { captureAllUserSnapshots, captureAllOrgSnapshots } from './risk-snapshot-batch.js';

export interface SnapshotConfig {
  userId?: string;
  orgId?: string;
  snapshotDate?: string; // ISO date string, defaults to today
}

export type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

export interface RiskSnapshotResult {
  id: string;
  userId: string | null;
  orgId: string | null;
  agentScore: number;
  cspmScore: number;
  combinedScore: number;
  grade: string;
  agentEventCount: number;
  cspmFindingCount: number;
  snapshotDate: string;
}

/**
 * Calculate grade from score (0-100)
 */
function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get agent activity summary for a user/org over the past day
 */
async function getAgentActivitySummary(
  db: Db,
  userId: string | undefined,
  orgId: string | undefined,
  sinceDate: string,
): Promise<AgentSummary> {
  const conditions = [];

  if (orgId) {
    conditions.push(eq(agentActivity.orgId, orgId));
  } else if (userId) {
    conditions.push(eq(agentActivity.userId, userId));
  } else {
    return { total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 };
  }

  conditions.push(gte(agentActivity.createdAt, sinceDate));

  const activities = await db
    .select({
      risk: agentActivity.risk,
      secretsCount: agentActivity.secretsCount,
    })
    .from(agentActivity)
    .where(and(...conditions));

  const summary: AgentSummary = {
    total: activities.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    secretsDetected: 0,
  };

  for (const activity of activities) {
    const risk = activity.risk as 'critical' | 'high' | 'medium' | 'low';
    summary[risk]++;
    summary.secretsDetected += activity.secretsCount;
  }

  return summary;
}

/**
 * Get CSPM findings summary for a user/org
 */
async function getCspmFindingsSummary(
  db: Db,
  orgId: string | undefined,
): Promise<CspmSummary> {
  if (!orgId) {
    return { critical: 0, high: 0, medium: 0, low: 0 };
  }

  const findings = await db
    .select({
      severity: cspmFindings.severity,
    })
    .from(cspmFindings)
    .where(and(eq(cspmFindings.orgId, orgId), eq(cspmFindings.status, 'open')));

  const summary: CspmSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const finding of findings) {
    summary[finding.severity]++;
  }

  return summary;
}

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(userId: string | null, orgId: string | null, date: string): string {
  const prefix = orgId ? 'org' : 'user';
  const id = orgId || userId || 'unknown';
  return `snap-${prefix}-${id}-${date}`;
}

/**
 * Capture a risk snapshot for a user or organization
 */
export async function captureRiskSnapshot(
  db: Db,
  config: SnapshotConfig = {},
): Promise<RiskSnapshotResult> {
  const { userId, orgId, snapshotDate } = config;

  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const date = snapshotDate || today;
  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get agent activity summary
  const agentSummary = await getAgentActivitySummary(db, userId, orgId, sinceDate);

  // Get CSPM findings summary (org-only)
  const cspmSummary = await getCspmFindingsSummary(db, orgId);

  // Calculate scores
  const agentScore = computeAgentScore(agentSummary);
  const cspmScore = computeCspmScore(cspmSummary);
  const combinedScore = Math.round(agentScore * 0.6 + cspmScore * 0.4);
  const grade = calculateGrade(combinedScore);

  // Generate snapshot ID
  const id = generateSnapshotId(userId ?? null, orgId ?? null, date!);

  // Insert snapshot
  await db.insert(agentRiskSnapshots).values({
    id,
    userId: userId || null,
    orgId: orgId || null,
    agentScore,
    cspmScore,
    combinedScore,
    grade,
    agentEventCount: agentSummary.total,
    cspmFindingCount: cspmSummary.critical + cspmSummary.high + cspmSummary.medium + cspmSummary.low,
    snapshotDate: date as string,
    createdAt: new Date().toISOString(),
  });

  return {
    id,
    userId: userId ?? null,
    orgId: orgId ?? null,
    agentScore,
    cspmScore,
    combinedScore,
    grade,
    agentEventCount: agentSummary.total,
    cspmFindingCount: cspmSummary.critical + cspmSummary.high + cspmSummary.medium + cspmSummary.low,
    snapshotDate: date as string,
  };
}
