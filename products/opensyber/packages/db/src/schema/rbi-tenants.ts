import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * OpenSyber Remote Browser Isolation (Sprint C3) — Kasm Workspaces tenants.
 *
 * `tf_rbi_tenants` is one row per Kasm cluster the customer operates. Cluster
 * provisioning lives in agent-runtime; this table stores the orchestration
 * metadata + encrypted API key secret used by `apps/api/routes/rbi-tenants.ts`.
 *
 * `tf_rbi_sessions` is one row per `request_kasm` invocation. The orchestrator
 * inserts on session start and updates on `destroyKasm` / status poll.
 */

export const tfRbiTenants = sqliteTable(
  'tf_rbi_tenants',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    orgId: text('org_id').references(() => organizations.id),
    tenantName: text('tenant_name').notNull(),
    /** Base URL of the customer's Kasm deployment. */
    kasmApiUrl: text('kasm_api_url').notNull(),
    /** Kasm Developer API key id (NOT the secret). */
    kasmApiKeyId: text('kasm_api_key_id').notNull(),
    /** Encrypted Kasm api_key_secret — sealed with ENCRYPTION_KEY at rest. */
    apiKeySecretEncrypted: text('api_key_secret_encrypted').notNull(),
    /** Default Kasm image to launch when policy doesn't pin one. */
    defaultImageId: text('default_image_id').notNull(),
    /** Default Kasm workspace id (alias for default_image_id, kept for clarity). */
    defaultWorkspaceId: text('default_workspace_id'),
    /** Hard cap on session lifetime (seconds). Enforced by orchestrator. */
    sessionMaxSeconds: integer('session_max_seconds').notNull().default(1800),
    status: text('status', {
      enum: ['provisioning', 'active', 'paused', 'error', 'deleted'],
    })
      .notNull()
      .default('provisioning'),
    activeSessionCount: integer('active_session_count').notNull().default(0),
    lastHealthCheckAt: text('last_health_check_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    ownerIdx: index('idx_tf_rbi_tenants_owner').on(table.ownerUserId),
    orgIdx: index('idx_tf_rbi_tenants_org').on(table.orgId),
    statusIdx: index('idx_tf_rbi_tenants_status').on(table.status),
  }),
);

export const tfRbiSessions = sqliteTable(
  'tf_rbi_sessions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tfRbiTenants.id),
    /** kasm_id returned by /api/public/request_kasm. */
    kasmId: text('kasm_id').notNull(),
    /** Kasm-side user identifier — distinct from OpenSyber userId. */
    userIdExternal: text('user_id_external').notNull(),
    imageId: text('image_id').notNull(),
    sourceUrl: text('source_url'),
    status: text('status', { enum: ['active', 'ended', 'error'] })
      .notNull()
      .default('active'),
    startedAt: text('started_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    endedAt: text('ended_at'),
  },
  (table) => ({
    tenantIdx: index('idx_tf_rbi_sessions_tenant').on(table.tenantId),
    kasmIdx: index('idx_tf_rbi_sessions_kasm').on(table.kasmId),
    statusIdx: index('idx_tf_rbi_sessions_status').on(table.status),
  }),
);

export type TfRbiTenant = typeof tfRbiTenants.$inferSelect;
export type NewTfRbiTenant = typeof tfRbiTenants.$inferInsert;
export type TfRbiSession = typeof tfRbiSessions.$inferSelect;
export type NewTfRbiSession = typeof tfRbiSessions.$inferInsert;
