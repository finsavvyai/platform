import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * OpenSyber DNS firewall — per-tenant Unbound + RPZ resolver state.
 *
 * One row per tenant resolver. Each row tracks the Hetzner VM that hosts
 * Unbound, the resolver's public IP, the current sync status, and a
 * 24h rolling counter of blocked queries (updated by the agent).
 *
 * VM provisioning is owned by `agent-runtime`, not this table — we only
 * store the `vm_id` reference so dashboard / API can join across.
 */

export const tfDnsTenants = sqliteTable(
  'tf_dns_tenants',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    orgId: text('org_id').references(() => organizations.id),

    /** Customer-facing tenant slug, e.g. `acme`. Unique per owner. */
    tenantName: text('tenant_name').notNull(),

    /** Hetzner VM identifier provisioned by agent-runtime. */
    vmId: text('vm_id'),

    /** Public IP the resolver listens on (IPv4 dotted-quad). */
    resolverIp: text('resolver_ip'),

    /** Lifecycle state. */
    status: text('status', {
      enum: ['provisioning', 'active', 'paused', 'error', 'deleted'],
    })
      .notNull()
      .default('provisioning'),

    /** Last successful feed sync timestamp (ISO8601). */
    lastSyncAt: text('last_sync_at'),

    /** Rolling 24h count of blocked queries. Updated by the agent. */
    blockedCount24h: integer('blocked_count_24h').notNull().default(0),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    ownerIdx: index('idx_tf_dns_tenants_owner').on(table.ownerUserId),
    orgIdx: index('idx_tf_dns_tenants_org').on(table.orgId),
    statusIdx: index('idx_tf_dns_tenants_status').on(table.status),
    vmIdx: index('idx_tf_dns_tenants_vm').on(table.vmId),
  }),
);

export type TfDnsTenant = typeof tfDnsTenants.$inferSelect;
export type NewTfDnsTenant = typeof tfDnsTenants.$inferInsert;
