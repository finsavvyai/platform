import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * OpenSyber Squid SWG (Sprint C2) — Secure Web Gateway tenants + audit log.
 *
 * `tf_swg_tenants` is one row per customer SWG instance. The Squid +
 * e2guardian VM lifecycle is owned by agent-runtime; this row stores the
 * policy + orchestration metadata that the API exposes through
 * `apps/api/src/routes/swg/*` and renders into squid.conf via
 * `@opensyber/swg-orchestrator`.
 *
 * `tf_swg_decisions` is the paged audit log of gateway decisions
 * (allow/block/warn). The row is appended by the agent on each
 * proxy decision so operators can audit policy outcomes.
 *
 * NOTE: this file intentionally self-exports without modifying the
 * `packages/db/src/schema/index.ts` barrel — Sprint C2 wiring uses
 * deep relative imports from the API route to keep the barrel stable.
 */

export const tfSwgTenants = sqliteTable(
  'tf_swg_tenants',
  {
    id: text('id').primaryKey(),
    /** Logical tenant identifier (org slug or user id). */
    tenantId: text('tenant_id').notNull(),

    /** Human-readable name shown in the dashboard. */
    name: text('name').notNull(),

    /**
     * Optional upstream proxy chain target, formatted as `host:port`.
     * When set, the orchestrator emits a Squid `cache_peer` directive.
     */
    upstreamProxy: text('upstream_proxy'),

    /** Default action when no allow/block list / category matches. */
    defaultAction: text('default_action', { enum: ['allow', 'block'] })
      .notNull()
      .default('allow'),

    /** JSON-encoded array of category ids to block (see SWG_CATEGORIES). */
    categoriesBlocked: text('categories_blocked').notNull().default('[]'),
    /** JSON-encoded explicit allowlist of fully-qualified domains. */
    domainsAllowlist: text('domains_allowlist').notNull().default('[]'),
    /** JSON-encoded explicit blocklist of fully-qualified domains. */
    domainsBlocklist: text('domains_blocklist').notNull().default('[]'),

    /** When true, Squid does TLS bumping (requires tenant root CA). */
    tlsIntercept: integer('tls_intercept', { mode: 'boolean' })
      .notNull()
      .default(false),

    /**
     * Hard cap on bytes the tenant is allowed to transit per UTC day.
     * 0 means unlimited. Enforced by the agent — the orchestrator just
     * stores the policy.
     */
    bytesLimitDaily: integer('bytes_limit_daily').notNull().default(0),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_swg_tenants_tenant').on(table.tenantId),
  }),
);

export const tfSwgDecisions = sqliteTable(
  'tf_swg_decisions',
  {
    id: text('id').primaryKey(),
    /** Logical tenant id — joins tf_swg_tenants.tenantId. */
    tenantId: text('tenant_id').notNull(),
    /** Optional originating user id (when known via auth proxy). */
    userId: text('user_id'),

    /** The request URL the gateway evaluated. */
    requestedUrl: text('requested_url').notNull(),
    /** SWG category id resolved at decision time, if any. */
    category: text('category'),

    /** Final action applied to the request. */
    action: text('action', { enum: ['allow', 'block', 'warn'] }).notNull(),

    /** Free-form reason string emitted by the rule engine. */
    reason: text('reason'),
    /** Bytes transferred (only meaningful for `allow`). */
    bytes: integer('bytes').notNull().default(0),

    ts: text('ts')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantTsIdx: index('idx_tf_swg_decisions_tenant_ts').on(
      table.tenantId,
      table.ts,
    ),
    actionIdx: index('idx_tf_swg_decisions_action').on(table.action),
    userIdx: index('idx_tf_swg_decisions_user').on(table.userId),
  }),
);

export type TfSwgTenant = typeof tfSwgTenants.$inferSelect;
export type NewTfSwgTenant = typeof tfSwgTenants.$inferInsert;
export type TfSwgDecision = typeof tfSwgDecisions.$inferSelect;
export type NewTfSwgDecision = typeof tfSwgDecisions.$inferInsert;
