/**
 * Visual Regression Database Schema
 * Tables for baselines, test results, and diff regions
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  decimal,
  index,
} from 'drizzle-orm/pg-core';

/** Baseline screenshots for visual comparison */
export const visualBaselines = pgTable(
  'visual_baselines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    version: integer('version').notNull().default(1),
    screenshotUrl: text('screenshot_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    viewport: jsonb('viewport'),
    url: text('url'),
    selector: varchar('selector', { length: 500 }),
    threshold: decimal('threshold', { precision: 5, scale: 2 }).default('0.1'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdx: index('vb_project_idx').on(table.projectId),
    nameIdx: index('vb_name_idx').on(table.projectId, table.name),
  }),
);

/** Results of visual regression test runs */
export const visualTestResults = pgTable(
  'visual_test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    baselineId: uuid('baseline_id').references(() => visualBaselines.id),
    testName: varchar('test_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(), // passed, failed, baseline-created
    mismatchPercentage: decimal('mismatch_percentage', { precision: 7, scale: 4 }).default('0'),
    mismatchCount: integer('mismatch_count').default(0),
    currentScreenshotUrl: text('current_screenshot_url'),
    diffImageUrl: text('diff_image_url'),
    duration: integer('duration_ms').default(0),
    url: text('url'),
    viewport: jsonb('viewport'),
    approvalPending: boolean('approval_pending').default(false),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at'),
    executedBy: uuid('executed_by'),
    error: text('error'),
    executedAt: timestamp('executed_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    projectIdx: index('vtr_project_idx').on(table.projectId),
    statusIdx: index('vtr_status_idx').on(table.status),
    baselineIdx: index('vtr_baseline_idx').on(table.baselineId),
  }),
);

/** Diff regions within a visual test result */
export const visualDiffRegions = pgTable(
  'visual_diff_regions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resultId: uuid('result_id')
      .notNull()
      .references(() => visualTestResults.id, { onDelete: 'cascade' }),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    mismatchCount: integer('mismatch_count').default(0),
    mismatchPercentage: decimal('mismatch_percentage', { precision: 7, scale: 4 }).default('0'),
  },
  (table) => ({
    resultIdx: index('vdr_result_idx').on(table.resultId),
  }),
);
