/**
 * Agent security report generator.
 *
 * Produces an HTML report with executive summary, risk scores,
 * top violations, and recommendations. Stores in R2.
 */

import { eq, and, desc } from 'drizzle-orm';
import { agentActivity, cspmFindings, agentPolicyViolations } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  computeCombinedRiskScore,
  type AgentSummary,
  type CspmSummary,
} from './combined-risk-score.js';
import { generatePdfReport } from './pdf-report-generator.js';

type Db = DrizzleD1Database<Record<string, unknown>>;

interface ReportEnv {
  STORAGE: R2Bucket;
}

interface ReportResult {
  reportId: string;
  downloadUrl: string;
  pdfUrl: string;
}

async function fetchAgentSummary(db: Db, orgId: string): Promise<AgentSummary> {
  const events = await db
    .select()
    .from(agentActivity)
    .where(eq(agentActivity.orgId, orgId))
    .limit(1000);

  const summary: AgentSummary = {
    total: events.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    secretsDetected: 0,
  };
  for (const e of events) {
    const key = e.risk as keyof Pick<AgentSummary, 'critical' | 'high' | 'medium' | 'low'>;
    if (key in summary) summary[key]++;
    summary.secretsDetected += e.secretsCount;
  }
  return summary;
}

async function fetchCspmSummary(db: Db, orgId: string): Promise<CspmSummary> {
  const findings = await db
    .select()
    .from(cspmFindings)
    .where(and(eq(cspmFindings.orgId, orgId), eq(cspmFindings.status, 'open')))
    .limit(1000);

  const summary: CspmSummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const key = f.severity as keyof CspmSummary;
    if (key in summary) summary[key]++;
  }
  return summary;
}

export async function generateAgentReport(
  db: Db,
  env: ReportEnv,
  orgId: string,
  orgName: string,
): Promise<ReportResult> {
  const [agentSummary, cspmSummary] = await Promise.all([
    fetchAgentSummary(db, orgId),
    fetchCspmSummary(db, orgId),
  ]);

  const score = computeCombinedRiskScore(agentSummary, cspmSummary);

  const violations = await db
    .select()
    .from(agentPolicyViolations)
    .where(eq(agentPolicyViolations.orgId, orgId))
    .orderBy(desc(agentPolicyViolations.createdAt))
    .limit(20);

  const reportId = crypto.randomUUID();

  // Generate HTML report (workers-compatible)
  const html = await generatePdfReport({
    orgName,
    agentSummary,
    cspmSummary,
    score,
    violations,
  });

  // Store HTML report
  await env.STORAGE.put(`reports/${orgId}/${reportId}.html`, html, {
    httpMetadata: { contentType: 'text/html' },
  });

  return {
    reportId,
    downloadUrl: `/api/agents/reports/${reportId}/download`,
    pdfUrl: `/api/agents/reports/${reportId}/download?format=html`,
  };
}
