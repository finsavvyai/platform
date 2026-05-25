import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * TokenForge ZTNA — per-app gating policy.
 *
 * Each row maps a public hostname (the customer's app, CNAME'd to the
 * ztna-proxy worker) to an upstream origin. The proxy enforces TokenForge
 * device verification + a minimum trust score before forwarding.
 */

export const tfZtnaApps = sqliteTable(
  'tf_ztna_apps',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    orgId: text('org_id').references(() => organizations.id),

    // Public-facing hostname (e.g., grafana.acme.com)
    hostname: text('hostname').notNull(),
    // Upstream origin to forward to (e.g., https://internal-grafana.acme.local)
    upstream: text('upstream').notNull(),

    // Minimum trust score (0–100) required to access this app.
    // verifyRequest() returns trustScore; below this we 403 with step-up.
    requiredTrustScore: integer('required_trust_score').notNull().default(70),

    // Whether to forward original request body for non-GET requests.
    // Disable for read-only apps to reduce risk.
    forwardWriteMethods: integer('forward_write_methods', { mode: 'boolean' })
      .notNull()
      .default(true),

    status: text('status', {
      enum: ['active', 'paused', 'deleted'],
    })
      .notNull()
      .default('active'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    hostnameIdx: uniqueIndex('idx_tf_ztna_apps_hostname').on(table.hostname),
  }),
);

export type TfZtnaApp = typeof tfZtnaApps.$inferSelect;
export type NewTfZtnaApp = typeof tfZtnaApps.$inferInsert;
