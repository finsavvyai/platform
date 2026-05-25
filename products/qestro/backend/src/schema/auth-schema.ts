import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }), // nullable for OAuth users
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    avatar: text("avatar"),
    role: varchar("role", { length: 20 }).notNull().default("user"), // user, admin, enterprise
    subscription: varchar("subscription", { length: 20 }).default("free"), // free, pro, enterprise
    isEmailVerified: boolean("is_email_verified").default(false),
    authMethod: varchar("auth_method", { length: 20 }).default("email"), // email, github, azure
    theme: varchar("theme", { length: 20 }).default("dark"), // light, dark, system
    lastActiveProjectId: uuid("last_active_project_id"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

// OAuth accounts table for storing provider-specific user information
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // github, azure, google
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    scope: text("scope"),
    tokenType: varchar("token_type", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    providerAccountIdx: index("oauth_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
    userIdIdx: index("oauth_user_id_idx").on(table.userId),
  }),
);

// Teams table
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id").notNull(),
    description: text("description"),
    plan: varchar("plan", { length: 50 }).default("free"),
    maxMembers: integer("max_members").default(5),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("teams_name_idx").on(table.name),
    ownerIdx: index("teams_owner_idx").on(table.ownerId),
  }),
);

// Team Members table
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 50 }).notNull().default("member"), // owner, admin, member
    joinedAt: timestamp("joined_at").defaultNow(),
    invitedBy: uuid("invited_by"),
  },
  (table) => ({
    teamUserIdx: index("team_members_team_user_idx").on(table.teamId, table.userId),
  }),
);

// API keys table
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 255 }).notNull(), // hashed API key
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(), // first few characters for identification
    permissions: jsonb("permissions").default([]), // array of permission strings
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    keyHashIdx: unique("api_keys_key_hash_unique").on(table.keyHash),
  }),
);

// Security audit logs table - Compliance and security tracking
export const securityAuditLogs = pgTable(
  "security_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Event details
    eventType: varchar("event_type", { length: 100 }).notNull(), // login, logout, data_access, permission_change, etc.
    eventCategory: varchar("event_category", { length: 50 }).notNull(), // authentication, authorization, data, system
    severity: varchar("severity", { length: 20 }).notNull(), // low, medium, high, critical

    // Event metadata
    description: text("description").notNull(),
    resourceType: varchar("resource_type", { length: 100 }), // user, project, test_case, plugin, etc.
    resourceId: uuid("resource_id"),

    // Request context
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    sessionId: varchar("session_id", { length: 255 }),

    // Additional data
    metadata: jsonb("metadata").default({}),

    // Status
    status: varchar("status", { length: 20 }).notNull(), // success, failure, blocked

    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("security_audit_logs_user_id_idx").on(table.userId),
    eventTypeIdx: index("security_audit_logs_event_type_idx").on(
      table.eventType,
    ),
    eventCategoryIdx: index("security_audit_logs_event_category_idx").on(
      table.eventCategory,
    ),
    severityIdx: index("security_audit_logs_severity_idx").on(table.severity),
    timestampIdx: index("security_audit_logs_timestamp_idx").on(
      table.timestamp,
    ),
    statusIdx: index("security_audit_logs_status_idx").on(table.status),
  }),
);
