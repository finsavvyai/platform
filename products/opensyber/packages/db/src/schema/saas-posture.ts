/**
 * SaaS Posture Management Schema
 *
 * Tables for SaaS account connections, posture findings, and OAuth app inventory.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const saasAccounts = sqliteTable('saas_accounts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // github, google-workspace, m365, slack
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  connectionType: text('connection_type').notNull(), // oauth, api-key, service-account
  lastScanAt: text('last_scan_at'),
  findingCount: integer('finding_count').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const saasFindings = sqliteTable('saas_findings', {
  id: text('id').primaryKey(),
  saasAccountId: text('saas_account_id').notNull().references(() => saasAccounts.id, { onDelete: 'cascade' }),
  orgId: text('org_id'),
  checkId: text('check_id').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull().default('open'),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  remediation: text('remediation').notNull(),
  firstSeenAt: text('first_seen_at').notNull().default(sql`(datetime('now'))`),
});

export const saasOauthApps = sqliteTable('saas_oauth_apps', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  appName: text('app_name').notNull(),
  appId: text('app_id').notNull(),
  provider: text('provider').notNull(),
  scopes: text('scopes'), // JSON array of granted scopes
  riskScore: integer('risk_score').default(0),
  riskLevel: text('risk_level').notNull().default('low'),
  grantedBy: text('granted_by'),
  isAiAgent: integer('is_ai_agent', { mode: 'boolean' }).default(false),
  lastAccessedAt: text('last_accessed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
