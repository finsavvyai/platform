/**
 * Risk Trend Service
 *
 * Retrieves historical risk trend data for users and organizations
 * from daily risk snapshots.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { agentRiskSnapshots } from '@opensyber/db';
import { eq, and, gte, desc } from 'drizzle-orm';

type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

/**
 * A single point in the risk trend timeline
 */
export interface TrendDataPoint {
  date: string;
  agentScore: number;
  cspmScore: number;
  combinedScore: number;
  grade: string;
}

/**
 * Options for querying risk trend data
 */
export interface TrendOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Get risk trend data for a user or org
 */
export async function getRiskTrend(
  db: Db,
  userId: string | undefined,
  orgId: string | undefined,
  options: TrendOptions = {},
): Promise<TrendDataPoint[]> {
  const { startDate, endDate, limit = 30 } = options;

  const conditions = [];

  if (orgId) {
    conditions.push(eq(agentRiskSnapshots.orgId, orgId));
  } else if (userId) {
    conditions.push(eq(agentRiskSnapshots.userId, userId));
  } else {
    return [];
  }

  if (startDate) {
    conditions.push(gte(agentRiskSnapshots.snapshotDate, startDate));
  }

  const snapshots = await db
    .select({
      date: agentRiskSnapshots.snapshotDate,
      agentScore: agentRiskSnapshots.agentScore,
      cspmScore: agentRiskSnapshots.cspmScore,
      combinedScore: agentRiskSnapshots.combinedScore,
      grade: agentRiskSnapshots.grade,
    })
    .from(agentRiskSnapshots)
    .where(and(...conditions))
    .orderBy(desc(agentRiskSnapshots.snapshotDate))
    .limit(limit);

  return snapshots.reverse().map((s) => ({
    date: s.date,
    agentScore: s.agentScore,
    cspmScore: s.cspmScore,
    combinedScore: s.combinedScore,
    grade: s.grade,
  }));
}
