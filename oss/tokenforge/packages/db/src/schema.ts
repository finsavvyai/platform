/**
 * TokenForge canonical schema — matches CISCO-dua.md §5 exactly.
 *
 *   tenants       a TokenForge customer (the developer/company)
 *   apps          one origin protected by TokenForge (customer or workforce mode)
 *   subjects      end-users — identity owned by the customer's app
 *   sessions      one device + one subject + one app
 *   audit_events  append-only audit log
 *   policies      workforce-mode policy DSL rows
 *   nonces        single-use refresh nonces (KV in prod, table here for tests)
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerEmail: text('owner_email').notNull(),
  plan: text('plan', { enum: ['free', 'pro', 'scale', 'workforce'] })
    .notNull()
    .default('free'),
  lemonSubId: text('lemon_sub_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const apps = sqliteTable(
  'apps',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    mode: text('mode', { enum: ['customer', 'workforce'] }).notNull(),
    name: text('name').notNull(),
    origin: text('origin').notNull(),
    apiKeyHash: text('api_key_hash').notNull(),
    shortCookieTtlSec: integer('short_cookie_ttl_sec').notNull().default(300),
    longCookieTtlSec: integer('long_cookie_ttl_sec').notNull().default(2592000),
    idpType: text('idp_type', { enum: ['none', 'oidc', 'saml'] }).notNull().default('none'),
    idpConfig: text('idp_config', { mode: 'json' }),
    enforcePolicy: integer('enforce_policy', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    tenantIdx: index('apps_tenant_idx').on(t.tenantId),
    originIdx: index('apps_origin_idx').on(t.origin),
  }),
);

export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id),
    externalSubject: text('external_subject').notNull(),
    metadata: text('metadata', { mode: 'json' }),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    appSubjectIdx: index('subjects_app_subject_idx').on(t.appId, t.externalSubject),
  }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id),
    subjectId: text('subject_id').notNull().references(() => subjects.id),
    publicKeyJwk: text('public_key_jwk', { mode: 'json' }).notNull(),
    bindingClass: text('binding_class', {
      enum: ['native_dbsc', 'webauthn', 'webcrypto'],
    }).notNull(),
    origin: text('origin').notNull(),
    userAgent: text('user_agent'),
    ipFirst: text('ip_first'),
    geoFirst: text('geo_first'),
    asnFirst: text('asn_first'),
    boundCookieHash: text('bound_cookie_hash').notNull(),
    boundCookieIssuedAt: integer('bound_cookie_issued_at', { mode: 'timestamp' }).notNull(),
    boundCookieExpiresAt: integer('bound_cookie_expires_at', { mode: 'timestamp' }).notNull(),
    longCookieHash: text('long_cookie_hash'),
    longCookieExpiresAt: integer('long_cookie_expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lastRefreshAt: integer('last_refresh_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
    revokedReason: text('revoked_reason'),
  },
  (t) => ({
    appIdx: index('sessions_app_idx').on(t.appId),
    subjectIdx: index('sessions_subject_idx').on(t.subjectId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull(),
    sessionId: text('session_id'),
    type: text('type').notNull(),
    severity: text('severity', { enum: ['info', 'warn', 'critical'] })
      .notNull()
      .default('info'),
    ip: text('ip'),
    geo: text('geo'),
    ua: text('ua'),
    payload: text('payload', { mode: 'json' }),
    at: integer('at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    appAtIdx: index('audit_app_at_idx').on(t.appId, t.at),
    sessionIdx: index('audit_session_idx').on(t.sessionId),
  }),
);

export const policies = sqliteTable('policies', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull().references(() => apps.id),
  name: text('name').notNull(),
  rules: text('rules', { mode: 'json' }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type App = typeof apps.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Policy = typeof policies.$inferSelect;
