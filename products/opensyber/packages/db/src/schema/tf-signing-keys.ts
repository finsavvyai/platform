import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * TokenForge signing keys (Sprint 35) — public JWKs published at
 * `/.well-known/tokenforge/jwks`. Used to sign risk-event webhooks
 * and (forthcoming) action-bound JWS responses.
 *
 * Status:
 *   active    — current signer; published; verifies + signs new events
 *   retiring  — older signer; published so verifiers can still validate
 *               in-flight signatures; does NOT sign new events
 *   revoked   — compromised; NEVER published; tokens previously signed
 *               by this key should be rejected by callers
 *
 * Private keys live elsewhere (KMS / wrangler secret) — this table only
 * stores the public JWK so the JWKS endpoint can serve it.
 */
export const tfSigningKeys = sqliteTable(
  'tf_signing_keys',
  {
    id: text('id').primaryKey(),
    /** JWKS `kid` — opaque, stable per key. */
    kid: text('kid').notNull().unique(),
    /** Signing algorithm. */
    alg: text('alg').notNull(),
    /** JSON-encoded public JWK (kty, crv, x, y for EC; kty, n, e for RSA). */
    publicJwk: text('public_jwk').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    rotatedAt: text('rotated_at'),
  },
  (table) => ({
    statusIdx: index('idx_tf_signing_keys_status').on(table.status),
  }),
);

export type TfSigningKey = typeof tfSigningKeys.$inferSelect;
export type NewTfSigningKey = typeof tfSigningKeys.$inferInsert;
