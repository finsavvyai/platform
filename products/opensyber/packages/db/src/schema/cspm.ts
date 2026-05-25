import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const cloudAccounts = sqliteTable('cloud_accounts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider', { enum: ['aws', 'gcp', 'azure'] }).notNull(),
  name: text('name').notNull(),
  externalId: text('external_id'),
  roleArn: text('role_arn'),
  credentials: text('credentials'), // encrypted JSON
  status: text('status', {
    enum: ['active', 'inactive', 'error', 'scanning'],
  }).notNull().default('active'),
  lastScanAt: text('last_scan_at'),
  scanSchedule: text('scan_schedule', {
    enum: ['manual', 'daily', 'weekly'],
  }).notNull().default('manual'),
  nextScanAt: text('next_scan_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const cspmScanRuns = sqliteTable('cspm_scan_runs', {
  id: text('id').primaryKey(),
  cloudAccountId: text('cloud_account_id')
    .notNull()
    .references(() => cloudAccounts.id, { onDelete: 'cascade' }),
  orgId: text('org_id').references(() => organizations.id),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status', {
    enum: ['running', 'completed', 'failed'],
  }).notNull().default('running'),
  findingCount: integer('finding_count').notNull().default(0),
  criticalCount: integer('critical_count').notNull().default(0),
  highCount: integer('high_count').notNull().default(0),
});

export const cspmFindings = sqliteTable('cspm_findings', {
  id: text('id').primaryKey(),
  scanRunId: text('scan_run_id')
    .notNull()
    .references(() => cspmScanRuns.id, { onDelete: 'cascade' }),
  cloudAccountId: text('cloud_account_id')
    .notNull()
    .references(() => cloudAccounts.id),
  orgId: text('org_id').references(() => organizations.id),
  checkId: text('check_id').notNull(),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull(),
  status: text('status', {
    enum: ['open', 'resolved', 'muted'],
  }).notNull().default('open'),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  region: text('region'),
  title: text('title').notNull(),
  description: text('description'),
  remediation: text('remediation'),
  complianceFrameworks: text('compliance_frameworks'), // JSON array
  firstSeenAt: text('first_seen_at').notNull(),
  resolvedAt: text('resolved_at'),
  mutedAt: text('muted_at'),
  mutedBy: text('muted_by').references(() => users.id),
});
