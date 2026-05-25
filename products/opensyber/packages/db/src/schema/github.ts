import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

// ─── GitHub App Installations ───────────────────────────────────────────────────

export const githubInstallations = sqliteTable('github_installations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  installationId: integer('installation_id').notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type', { enum: ['User', 'Organization'] }).notNull(),
  permissions: text('permissions'), // JSON
  events: text('events'), // JSON
  repoSelection: text('repo_selection', { enum: ['all', 'selected'] }).notNull().default('all'),
  suspendedAt: text('suspended_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── GitHub Repos ───────────────────────────────────────────────────────────────

export const githubRepos = sqliteTable('github_repos', {
  id: text('id').primaryKey(),
  installationId: text('installation_id').notNull().references(() => githubInstallations.id, { onDelete: 'cascade' }),
  repoFullName: text('repo_full_name').notNull().unique(),
  defaultBranch: text('default_branch').notNull().default('main'),
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
  language: text('language'),
  lastScanAt: text('last_scan_at'),
  findingCount: integer('finding_count').notNull().default(0),
  status: text('status', { enum: ['active', 'archived', 'removed'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Action References ──────────────────────────────────────────────────────────

export const actionRefs = sqliteTable('action_refs', {
  id: text('id').primaryKey(),
  repoId: text('repo_id').notNull().references(() => githubRepos.id, { onDelete: 'cascade' }),
  workflowFile: text('workflow_file').notNull(),
  actionRef: text('action_ref').notNull(),
  pinnedSha: text('pinned_sha'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  isTrusted: integer('is_trusted', { mode: 'boolean' }).notNull().default(false),
  riskLevel: text('risk_level', { enum: ['safe', 'low', 'medium', 'high', 'critical', 'unknown'] }).notNull().default('unknown'),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── IOC Feed ───────────────────────────────────────────────────────────────────

export const iocFeed = sqliteTable('ioc_feed', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['domain', 'ip', 'sha256', 'url', 'email'] }).notNull(),
  value: text('value').notNull(),
  actor: text('actor'),
  severity: text('severity', { enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }).notNull().default('HIGH'),
  incidentRef: text('incident_ref'),
  source: text('source').notNull().default('opensyber'),
  firstSeenAt: text('first_seen_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
