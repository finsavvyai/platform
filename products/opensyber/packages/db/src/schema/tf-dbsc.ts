import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * TokenForge DBSC (Sprint 37) — W3C Device Bound Session Credentials.
 *
 * Two-table model:
 *   tf_dbsc_sessions       one row per bound session (= one device per
 *                          tenant per origin). Stores the registered
 *                          public key and the rotating bound-cookie id.
 *   tf_dbsc_challenges     short-lived nonce store for the registration
 *                          and refresh ceremonies. Rows expire in <=120s
 *                          and are cleaned up by the refresh endpoint.
 *
 * The bound-cookie value itself is opaque and never stored in clear here:
 * we keep its SHA-256 hash so a DB leak does not yield session takeover.
 */

export const tfDbscSessions = sqliteTable(
  'tf_dbsc_sessions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    deviceId: text('device_id').notNull(),
    /** Registered public key in JWK or PEM-SPKI form. */
    publicKey: text('public_key').notNull(),
    /** ES256 only today, ES384/EdDSA later. */
    alg: text('alg').notNull().default('ES256'),
    /** Origin the session is scoped to (lowercased, no trailing slash). */
    origin: text('origin').notNull(),
    /** SHA-256 of current bound-cookie value. Rotates every refresh. */
    boundCookieHash: text('bound_cookie_hash').notNull(),
    /** Cookie lifecycle. */
    boundCookieIssuedAt: text('bound_cookie_issued_at').notNull(),
    boundCookieExpiresAt: text('bound_cookie_expires_at').notNull(),
    /** Optional WebAuthn attestation captured at registration. */
    attestation: text('attestation'),
    /** Soft-revoke flag — set when /v1/dbsc/revoke is called. */
    revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
    revokedReason: text('revoked_reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_dbsc_sessions_tenant').on(table.tenantId),
    deviceIdx: index('idx_tf_dbsc_sessions_device').on(table.deviceId),
    cookieIdx: index('idx_tf_dbsc_sessions_cookie').on(table.boundCookieHash),
  }),
);

export const tfDbscChallenges = sqliteTable(
  'tf_dbsc_challenges',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    /** SHA-256 hash of the challenge bytes — never the bytes themselves. */
    challengeHash: text('challenge_hash').notNull(),
    /** What the client must do with this challenge. */
    purpose: text('purpose', { enum: ['register', 'refresh', 'step_up'] }).notNull(),
    /** Optional binding to a specific session (refresh + step_up). */
    sessionId: text('session_id'),
    /** Optional binding to a specific action (step_up). */
    actionHash: text('action_hash'),
    issuedAt: text('issued_at').notNull().default(sql`(datetime('now'))`),
    expiresAt: text('expires_at').notNull(),
    /** One-shot — set when consumed so we can detect replay. */
    consumed: integer('consumed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    hashIdx: index('idx_tf_dbsc_challenges_hash').on(table.challengeHash),
    expiryIdx: index('idx_tf_dbsc_challenges_expiry').on(table.expiresAt),
  }),
);

export type TfDbscSession = typeof tfDbscSessions.$inferSelect;
export type NewTfDbscSession = typeof tfDbscSessions.$inferInsert;
export type TfDbscChallenge = typeof tfDbscChallenges.$inferSelect;
export type NewTfDbscChallenge = typeof tfDbscChallenges.$inferInsert;
