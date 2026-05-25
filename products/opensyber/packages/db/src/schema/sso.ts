import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

// ─── SSO Configurations ──────────────────────────────────────────────────────

export const ssoConfigs = sqliteTable('sso_configs', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['saml', 'oidc'] }).notNull(),
  // SAML fields
  entityId: text('entity_id'),
  ssoUrl: text('sso_url'),
  certificate: text('certificate'),
  // OIDC fields
  oidcClientId: text('oidc_client_id'),
  oidcClientSecretEncrypted: text('oidc_client_secret_encrypted'),
  oidcIssuer: text('oidc_issuer'),
  // Shared config
  autoProvision: integer('auto_provision').notNull().default(0),
  defaultRole: text('default_role').notNull().default('viewer'),
  isActive: integer('is_active').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
