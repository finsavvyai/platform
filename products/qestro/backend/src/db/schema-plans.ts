import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { projects, users } from './schema';

export const testPlans = sqliteTable('test_plans', {
  id: text('id').primaryKey(),
  // Human-readable display ID (e.g. "TP-0042"). UNIQUE; nullable during backfill.
  displayId: text('display_id'),
  projectId: text('project_id').references(() => projects.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'),
  ownerId: text('owner_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const testRuns = sqliteTable('test_runs', {
  id: text('id').primaryKey(),
  // Human-readable display ID (e.g. "RN-0042"). UNIQUE; nullable during backfill.
  displayId: text('display_id'),
  testPlanId: text('test_plan_id').references(() => testPlans.id),
  projectId: text('project_id').references(() => projects.id).notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  environment: text('environment'),
  passed: integer('passed').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  total: integer('total').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const cycles = sqliteTable('cycles', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('planning'),
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  ownerId: text('owner_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
