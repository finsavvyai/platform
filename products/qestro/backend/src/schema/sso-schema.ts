import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema.js";

// SSO Configuration Table
export const ssoConfigs = pgTable(
  "sso_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    providerType: varchar("provider_type", { length: 50 }).notNull(), // azure_ad, okta, google, saml_generic, oidc_generic
    enabled: boolean("enabled").default(true),

    // OIDC/OAuth Config
    clientId: varchar("client_id", { length: 255 }),
    clientSecret: text("client_secret"),
    authorizationUrl: varchar("authorization_url", { length: 500 }),
    tokenUrl: varchar("token_url", { length: 500 }),
    userInfoUrl: varchar("user_info_url", { length: 500 }),
    redirectUris: text("redirect_uris"), // JSON array
    scopes: text("scopes"), // JSON array

    // SAML Config
    entryPoint: varchar("entry_point", { length: 500 }),
    issuer: varchar("issuer", { length: 255 }),
    cert: text("cert"),
    privateKey: text("private_key"),
    identifierFormat: varchar("identifier_format", { length: 255 }),

    // Claim/Attribute Mapping
    emailClaim: varchar("email_claim", { length: 255 }).default("email"),
    nameClaim: varchar("name_claim", { length: 255 }).default("name"),
    groupsClaim: varchar("groups_claim", { length: 255 }).default("groups"),
    customAttributes: jsonb("custom_attributes").default({}),

    // Group/Role Mapping
    groupMappings: jsonb("group_mappings").default({}),
    autoProvision: boolean("auto_provision").default(true),
    autoAssignRole: varchar("auto_assign_role", { length: 50 }).default("user"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("sso_configs_org_id_idx").on(table.organizationId),
    providerIdx: index("sso_configs_provider_idx").on(table.providerType),
  })
);

// SSO Session Table
export const ssoSessions = pgTable(
  "sso_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    providerType: varchar("provider_type", { length: 50 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("sso_sessions_user_id_idx").on(table.userId),
    orgIdIdx: index("sso_sessions_org_id_idx").on(table.organizationId),
    providerIdx: index("sso_sessions_provider_idx").on(table.providerType),
    expiresAtIdx: index("sso_sessions_expires_at_idx").on(table.expiresAt),
  })
);
