import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * TokenForge workforce mode (Sprint 40) — B2B IdP-fronted DBSC sessions.
 *
 * One table:
 *   tf_workforce_apps   per-tenant workforce config. Each row binds an
 *                       OIDC IdP (Okta / Entra / Google Workspace / Auth0)
 *                       to a TokenForge "app" the customer protects with
 *                       device-bound sessions. Customer-tier tenants do
 *                       not use this table at all; absence = customer
 *                       mode (existing behaviour).
 *
 * `aud` is the IdP-side client ID the user's browser presents during
 * the SSO flow; we verify ID-token claims against it before issuing
 * a DBSC challenge.
 */

export const tfWorkforceApps = sqliteTable(
  'tf_workforce_apps',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    idpType: text('idp_type', {
      enum: ['oidc_okta', 'oidc_entra', 'oidc_google', 'oidc_auth0', 'oidc_generic'],
    }).notNull(),
    /** OIDC issuer URL — e.g. https://acme.okta.com/oauth2/default. */
    issuer: text('issuer').notNull(),
    /** Client ID issued by the IdP and embedded in the customer's frontend. */
    audience: text('audience').notNull(),
    /** JWKS endpoint — cached server-side, refreshed every 24h. */
    jwksUri: text('jwks_uri').notNull(),
    /** Optional override for token endpoint (custom IdPs). */
    tokenEndpoint: text('token_endpoint'),
    /** Allowed sub-domains for the workforce app (CORS gate). */
    allowedOrigins: text('allowed_origins').notNull().default(''),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantIdx: index('idx_tf_workforce_apps_tenant').on(table.tenantId),
    audienceIdx: uniqueIndex('idx_tf_workforce_apps_aud').on(table.tenantId, table.audience),
  }),
);

export type TfWorkforceApp = typeof tfWorkforceApps.$inferSelect;
export type NewTfWorkforceApp = typeof tfWorkforceApps.$inferInsert;
