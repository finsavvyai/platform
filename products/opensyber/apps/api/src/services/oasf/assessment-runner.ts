/**
 * OASF Assessment Runner
 *
 * Orchestrates: collect evidence → evaluate controls → persist results.
 */
import { eq, desc } from 'drizzle-orm';
import { oasfAssessments, oasfAssessmentResults, oasfEvidenceItems } from '@opensyber/db';
import { collectEvidence } from './evidence-collector.js';
import { evaluateControls } from './control-evaluator.js';
import type { AssessmentResult } from './types.js';

export function computeGrade(score: number): string {
  if (score === 100) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export async function runAssessment(
  db: any, orgId: string, triggeredBy: string,
): Promise<AssessmentResult> {
  const ctx = await collectEvidence(db, orgId);
  const controls = evaluateControls(ctx);

  const passing = controls.filter((c) => c.status === 'pass').length;
  const failing = controls.filter((c) => c.status === 'fail').length;
  const partial = controls.filter((c) => c.status === 'partial').length;
  const total = controls.length;
  const score = Math.round((passing / total) * 100);
  const grade = computeGrade(score);

  const assessmentId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(oasfAssessments).values({
    id: assessmentId, orgId, overallScore: score, grade,
    passingCount: passing, failingCount: failing, partialCount: partial,
    totalControls: total, triggeredBy, status: 'completed', completedAt: now,
  });

  for (const ctrl of controls) {
    const resultId = crypto.randomUUID();
    await db.insert(oasfAssessmentResults).values({
      id: resultId, assessmentId, controlId: ctrl.controlId,
      status: ctrl.status, evidenceSummary: ctrl.evidenceSummary,
      evidenceDetails: ctrl.evidenceDetails,
    });
    await db.insert(oasfEvidenceItems).values({
      id: crypto.randomUUID(), resultId, controlId: ctrl.controlId,
      sourceTable: ctrl.sourceTable, recordCount: ctrl.recordCount,
      sampleData: ctrl.evidenceDetails,
    });
  }

  return { assessmentId, overallScore: score, grade, passingCount: passing, failingCount: failing, partialCount: partial, totalControls: total, controls };
}

export async function getAssessmentHistory(db: any, orgId: string, limit = 10): Promise<any[]> {
  return db.select().from(oasfAssessments)
    .where(eq(oasfAssessments.orgId, orgId))
    .orderBy(desc(oasfAssessments.createdAt))
    .limit(limit);
}

export async function getAssessmentDetail(db: any, assessmentId: string): Promise<any> {
  const [assessment] = await db.select().from(oasfAssessments)
    .where(eq(oasfAssessments.id, assessmentId));
  if (!assessment) return null;

  const results = await db.select().from(oasfAssessmentResults)
    .where(eq(oasfAssessmentResults.assessmentId, assessmentId));

  return { ...assessment, results };
}
