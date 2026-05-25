import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

/**
 * OASF Compliance Assessments
 *
 * Each row = one full evaluation of all 15 OASF controls for an org.
 */
export const oasfAssessments = sqliteTable('oasf_assessments', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score').notNull(),
  grade: text('grade').notNull(),
  passingCount: integer('passing_count').notNull(),
  failingCount: integer('failing_count').notNull(),
  partialCount: integer('partial_count').notNull(),
  totalControls: integer('total_controls').notNull(),
  triggeredBy: text('triggered_by').notNull(),
  status: text('status').notNull().default('completed'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * OASF Assessment Results
 *
 * Per-control result within an assessment.
 */
export const oasfAssessmentResults = sqliteTable('oasf_assessment_results', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id').notNull().references(() => oasfAssessments.id, { onDelete: 'cascade' }),
  controlId: text('control_id').notNull(),
  status: text('status').notNull(),
  evidenceSummary: text('evidence_summary').notNull(),
  evidenceDetails: text('evidence_details'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * OASF Evidence Items
 *
 * Immutable evidence records linked to assessment results.
 */
export const oasfEvidenceItems = sqliteTable('oasf_evidence_items', {
  id: text('id').primaryKey(),
  resultId: text('result_id').notNull().references(() => oasfAssessmentResults.id, { onDelete: 'cascade' }),
  controlId: text('control_id').notNull(),
  sourceTable: text('source_table').notNull(),
  recordCount: integer('record_count').notNull(),
  sampleData: text('sample_data'),
  collectedAt: text('collected_at').notNull().default(sql`(datetime('now'))`),
});
