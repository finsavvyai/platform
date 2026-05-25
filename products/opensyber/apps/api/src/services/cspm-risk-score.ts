/**
 * CSPM Risk Score Calculation
 *
 * Calculates per-account and per-org risk scores from CSPM findings.
 * Score: 0-100 (100 = perfect security, 0 = critical risk)
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { cspmFindings, cloudAccounts } from '@opensyber/db';

type Db = DrizzleD1Database<Record<string, unknown>>;

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 10, high: 5, medium: 2, low: 1,
};

export interface RiskScore {
  score: number;
  grade: string;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  weightedRisk: number;
}

export async function calculateAccountRiskScore(db: Db, cloudAccountId: string): Promise<RiskScore> {
  const findings = await db.select({
    severity: cspmFindings.severity,
    count: sql<number>`count(*)`.as('count'),
  })
    .from(cspmFindings)
    .where(and(eq(cspmFindings.cloudAccountId, cloudAccountId), eq(cspmFindings.status, 'open')))
    .groupBy(cspmFindings.severity);

  return computeScore(findings);
}

export async function calculateOrgRiskScore(db: Db, orgId: string): Promise<RiskScore> {
  const accounts = await db.select({ id: cloudAccounts.id })
    .from(cloudAccounts).where(eq(cloudAccounts.orgId, orgId));

  if (accounts.length === 0) {
    return { score: 100, grade: 'A+', findingCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, weightedRisk: 0 };
  }

  const findings = await db.select({
    severity: cspmFindings.severity,
    count: sql<number>`count(*)`.as('count'),
  })
    .from(cspmFindings)
    .where(and(eq(cspmFindings.orgId, orgId), eq(cspmFindings.status, 'open')))
    .groupBy(cspmFindings.severity);

  return computeScore(findings);
}

function computeScore(findings: { severity: string; count: number }[]): RiskScore {
  let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
  let weightedRisk = 0;

  for (const f of findings) {
    const count = Number(f.count);
    weightedRisk += count * (SEVERITY_WEIGHTS[f.severity] ?? 1);
    if (f.severity === 'critical') criticalCount = count;
    else if (f.severity === 'high') highCount = count;
    else if (f.severity === 'medium') mediumCount = count;
    else lowCount = count;
  }

  const findingCount = criticalCount + highCount + mediumCount + lowCount;
  const score = Math.max(0, Math.round(100 - Math.min(weightedRisk, 100)));
  const grade = computeGrade(score);

  return { score, grade, findingCount, criticalCount, highCount, mediumCount, lowCount, weightedRisk };
}

function computeGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}
