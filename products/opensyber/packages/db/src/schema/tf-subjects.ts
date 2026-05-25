import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * TokenForge subjects (Sprint 41) — workforce-mode end-users.
 *
 * One row per (workforce_app, externalSubject) — i.e. per IdP-attested
 * person inside a customer's workforce app. A single subject can have
 * many DBSC sessions (one per device), all of which can be revoked
 * together by tenant admins.
 *
 * `external_subject` is whatever the IdP places in the OIDC `sub` claim
 * (Okta + Entra: opaque GUID; Google: numeric string). We store the
 * email separately so the dashboard can render a human label without
 * re-querying the IdP.
 */

export const tfSubjects = sqliteTable(
  'tf_subjects',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    workforceAppId: text('workforce_app_id').notNull(),
    /** OIDC `sub` claim verbatim. */
    externalSubject: text('external_subject').notNull(),
    email: text('email'),
    name: text('name'),
    /** JSON-encoded extra claims (groups, roles, etc.). */
    metadata: text('metadata'),
    firstSeenAt: text('first_seen_at').notNull().default(sql`(datetime('now'))`),
    lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_subjects_tenant').on(table.tenantId),
    appSubjectIdx: uniqueIndex('idx_tf_subjects_app_subject').on(
      table.workforceAppId,
      table.externalSubject,
    ),
    emailIdx: index('idx_tf_subjects_email').on(table.email),
  }),
);

export type TfSubject = typeof tfSubjects.$inferSelect;
export type NewTfSubject = typeof tfSubjects.$inferInsert;
