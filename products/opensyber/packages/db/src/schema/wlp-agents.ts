import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * OpenSyber Sprint D1 — Workload Protection (Falco + osquery + Wazuh).
 *
 * Two-table model:
 *   - tf_wlp_agents   one row per host (Linux/macOS/container) running the
 *                     OpenSyber WLP daemon. agent_type is the engine that
 *                     emitted the heartbeat (a single host may have several
 *                     engines installed → several rows).
 *   - tf_wlp_findings runtime-detection events shipped by the agent. The
 *                     `mitre_technique` column matches the technique stored
 *                     against the FALCO_RULES catalog in
 *                     packages/wlp-orchestrator/src/falco-rules.ts.
 *
 * Self-export only — this file is intentionally NOT added to schema/index.ts.
 */

export const tfWlpAgents = sqliteTable(
  'tf_wlp_agents',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    orgId: text('org_id').references(() => organizations.id),

    /** Hostname reported by the agent. */
    hostname: text('hostname').notNull(),

    /** Which engine this row represents. */
    agentType: text('agent_type', {
      enum: ['falco', 'osquery', 'wazuh'],
    }).notNull(),

    /** Engine version string (e.g. "0.40.0", "5.13.0", "4.10.1"). */
    version: text('version').notNull(),

    /** Last heartbeat timestamp (ISO8601). */
    lastSeenAt: text('last_seen_at'),

    /** Lifecycle. Stale = no heartbeat in N minutes; offline = explicitly deregistered. */
    status: text('status', {
      enum: ['active', 'stale', 'offline'],
    })
      .notNull()
      .default('active'),

    /** JSON-encoded array of free-form tags (env, role, region…). */
    tags: text('tags').notNull().default('[]'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_wlp_agents_tenant').on(table.tenantId),
    ownerIdx: index('idx_tf_wlp_agents_owner').on(table.ownerUserId),
    statusIdx: index('idx_tf_wlp_agents_status').on(table.status),
  }),
);

export const tfWlpFindings = sqliteTable(
  'tf_wlp_findings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    agentId: text('agent_id')
      .notNull()
      .references(() => tfWlpAgents.id),

    /** Verbatim upstream rule name (Falco) or query name (osquery/Wazuh). */
    ruleId: text('rule_id').notNull(),

    severity: text('severity', {
      enum: ['critical', 'high', 'medium', 'low', 'info'],
    }).notNull(),

    /** MITRE ATT&CK technique ID (e.g. "T1059"). */
    mitreTechnique: text('mitre_technique').notNull(),

    title: text('title').notNull(),
    description: text('description').notNull(),

    /** JSON-encoded raw event from the agent. */
    rawEvent: text('raw_event').notNull(),

    detectedAt: text('detected_at')
      .notNull()
      .default(sql`(datetime('now'))`),

    /** Set when an operator marks the finding as resolved. */
    resolvedAt: text('resolved_at'),
  },
  (table) => ({
    tenantTimeIdx: index('idx_tf_wlp_findings_tenant_time').on(
      table.tenantId,
      table.detectedAt,
    ),
    agentIdx: index('idx_tf_wlp_findings_agent').on(table.agentId),
    severityTimeIdx: index('idx_tf_wlp_findings_severity_time').on(
      table.severity,
      table.detectedAt,
    ),
  }),
);

export type TfWlpAgent = typeof tfWlpAgents.$inferSelect;
export type NewTfWlpAgent = typeof tfWlpAgents.$inferInsert;
export type TfWlpFinding = typeof tfWlpFindings.$inferSelect;
export type NewTfWlpFinding = typeof tfWlpFindings.$inferInsert;
