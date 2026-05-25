import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { instances } from './instances.js';
import { users } from './users.js';

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  name: text('name').notNull(),
  eventType: text('event_type').notNull(),
  severityFilter: text('severity_filter'),
  threshold: integer('threshold').notNull().default(1),
  windowMinutes: integer('window_minutes').notNull().default(60),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(30),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  alertRuleId: text('alert_rule_id')
    .notNull()
    .references(() => alertRules.id),
  severity: text('severity', {
    enum: ['info', 'warning', 'critical'],
  }).notNull(),
  title: text('title').notNull(),
  details: text('details'),
  status: text('status', {
    enum: ['open', 'acknowledged', 'resolved'],
  })
    .notNull()
    .default('open'),
  triggeredCount: integer('triggered_count').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  acknowledgedAt: text('acknowledged_at'),
  resolvedAt: text('resolved_at'),
});

export const notificationChannels = sqliteTable('notification_channels', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  channelType: text('channel_type', {
    enum: ['email', 'webhook', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord'],
  }).notNull(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const networkActivity = sqliteTable('network_activity', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  domain: text('domain').notNull(),
  method: text('method').notNull(),
  path: text('path'),
  statusCode: integer('status_code'),
  action: text('action', {
    enum: ['allowed', 'blocked'],
  })
    .notNull()
    .default('allowed'),
  bytesTransferred: integer('bytes_transferred'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const fileBaselines = sqliteTable('file_baselines', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  filePath: text('file_path').notNull(),
  sha256: text('sha256').notNull(),
  permissions: text('permissions'),
  size: integer('size'),
  lastVerified: text('last_verified')
    .notNull()
    .default(sql`(datetime('now'))`),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const fileIntegrityEvents = sqliteTable('file_integrity_events', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  filePath: text('file_path').notNull(),
  changeType: text('change_type', {
    enum: ['modified', 'created', 'deleted', 'permissions_changed'],
  }).notNull(),
  previousHash: text('previous_hash'),
  currentHash: text('current_hash'),
  details: text('details'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const vulnerabilityScans = sqliteTable('vulnerability_scans', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  scanner: text('scanner').notNull(),
  criticalCount: integer('critical_count').notNull().default(0),
  highCount: integer('high_count').notNull().default(0),
  mediumCount: integer('medium_count').notNull().default(0),
  lowCount: integer('low_count').notNull().default(0),
  scannedAt: text('scanned_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const vulnerabilities = sqliteTable('vulnerabilities', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  scanId: text('scan_id')
    .notNull()
    .references(() => vulnerabilityScans.id),
  cveId: text('cve_id'),
  packageName: text('package_name').notNull(),
  packageVersion: text('package_version'),
  fixedVersion: text('fixed_version'),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull(),
  title: text('title'),
  description: text('description'),
  status: text('status', {
    enum: ['open', 'in_progress', 'fixed', 'ignored', 'false_positive'],
  })
    .notNull()
    .default('open'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const complianceReports = sqliteTable('compliance_reports', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  framework: text('framework', {
    enum: ['soc2', 'iso27001', 'cis', 'hipaa', 'gdpr', 'nist_csf', 'pci_dss'],
  }).notNull(),
  overallScore: integer('overall_score').notNull(),
  totalControls: integer('total_controls').notNull(),
  passingControls: integer('passing_controls').notNull(),
  failingControls: integer('failing_controls').notNull(),
  results: text('results').notNull(),
  generatedAt: text('generated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const accessControlLog = sqliteTable('access_control_log', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  accessType: text('access_type', {
    enum: ['api', 'ssh', 'console'],
  }).notNull(),
  sourceIp: text('source_ip'),
  sourceCountry: text('source_country'),
  action: text('action', {
    enum: ['allowed', 'denied'],
  }).notNull(),
  details: text('details'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
