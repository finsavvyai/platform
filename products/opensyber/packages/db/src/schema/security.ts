import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { instances } from './instances.js';

// ─── Security Events ────────────────────────────────────────────────────────────

export const securityEvents = sqliteTable('security_events', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  eventType: text('event_type', {
    enum: [
      'skill_blocked',
      'skill_installed',
      'skill_removed',
      'anomaly_detected',
      'credential_access',
      'unauthorized_network',
      'file_access_violation',
      'update_applied',
      'instance_hardened',
      'brute_force_attempt',
    ],
  }).notNull(),
  severity: text('severity', {
    enum: ['info', 'warning', 'critical'],
  }).notNull(),
  skillId: text('skill_id'),
  sourceIp: text('source_ip'),
  sourceCountry: text('source_country'),
  details: text('details'), // JSON blob
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Audit Log ──────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  action: text('action', {
    enum: [
      'shell_exec',
      'file_read',
      'file_write',
      'http_request',
      'credential_access',
      'skill_install',
      'skill_uninstall',
      'config_change',
    ],
  }).notNull(),
  skillId: text('skill_id'),
  actorId: text('actor_id'), // userId who triggered the action
  details: text('details'), // JSON blob
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Security Policies ──────────────────────────────────────────────────────────

export const securityPolicies = sqliteTable('security_policies', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  orgId: text('org_id'), // nullable FK to organizations (constraint in migration)
  policyType: text('policy_type', {
    enum: [
      'network_allowlist',
      'network_blocklist',
      'file_path_rules',
      'shell_command_rules',
      'ip_allowlist',
      'rate_limit',
    ],
  }).notNull(),
  name: text('name').notNull(),
  rules: text('rules').notNull(), // JSON blob
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Incidents ──────────────────────────────────────────────────────────────────

export const incidents = sqliteTable('incidents', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  orgId: text('org_id'), // nullable FK to organizations (constraint in migration)
  title: text('title').notNull(),
  description: text('description'),
  severity: text('severity', {
    enum: ['low', 'medium', 'high', 'critical'],
  }).notNull(),
  status: text('status', {
    enum: ['open', 'investigating', 'contained', 'resolved', 'closed'],
  })
    .notNull()
    .default('open'),
  rootCause: text('root_cause'),
  remediation: text('remediation'),
  assignee: text('assignee'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
});

// ─── Incident Events (Timeline) ────────────────────────────────────────────────

export const incidentEvents = sqliteTable('incident_events', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id')
    .notNull()
    .references(() => incidents.id),
  eventType: text('event_type', {
    enum: ['status_change', 'comment', 'evidence', 'assignment'],
  }).notNull(),
  content: text('content').notNull(),
  authorId: text('author_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Incident <-> Security Events (Junction) ─────────────────────────────────

export const incidentSecurityEvents = sqliteTable('incident_security_events', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id')
    .notNull()
    .references(() => incidents.id),
  securityEventId: text('security_event_id')
    .notNull()
    .references(() => securityEvents.id),
  linkedAt: text('linked_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Security Score History ─────────────────────────────────────────────────────

export const securityScoreHistory = sqliteTable('security_score_history', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  overall: integer('overall').notNull(),
  credentialSecurity: integer('credential_security').notNull(),
  skillSafety: integer('skill_safety').notNull(),
  networkSecurity: integer('network_security').notNull(),
  updateStatus: integer('update_status').notNull(),
  configurationHardening: integer('configuration_hardening').notNull(),
  vulnerabilityManagement: integer('vulnerability_management').notNull(),
  incidentReadiness: integer('incident_readiness').notNull(),
  recordedAt: text('recorded_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
