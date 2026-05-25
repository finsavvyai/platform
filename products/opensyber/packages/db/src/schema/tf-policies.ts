import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * TokenForge policy DSL (Sprint 38) — workforce-tier session policies.
 *
 * One table:
 *   tf_policies   per-tenant policy rules evaluated on every DBSC refresh
 *                 after the built-in risk signals. Rules are JSON; see
 *                 packages/tokenforge/src/server/policy.ts for the DSL
 *                 grammar and evaluator.
 *
 * Policies fail open: if `rules` is malformed or evaluator throws we fall
 * back to the risk-signal action so policy bugs cannot lock users out.
 */

export const tfPolicies = sqliteTable(
  'tf_policies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    /** Human-readable label shown in dashboard. */
    name: text('name').notNull(),
    /** JSON-encoded rule per spec §5.1: { if_any?: Rule[]; if_all?: Rule[]; then: Action }. */
    rules: text('rules').notNull(),
    /** Lower priority runs first; first non-allow action wins. */
    priority: integer('priority').notNull().default(100),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_policies_tenant').on(table.tenantId),
    enabledIdx: index('idx_tf_policies_enabled').on(table.tenantId, table.enabled),
  }),
);

export type TfPolicy = typeof tfPolicies.$inferSelect;
export type NewTfPolicy = typeof tfPolicies.$inferInsert;
