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
} from "drizzle-orm/pg-core";
import { users } from "./index.js";
import { projects } from "./index.js";

// ==========================================
// API TESTING STUDIO TABLES
// ==========================================

// API Testing Collections
export const apiTestingCollections = pgTable(
  "api_testing_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    variables: jsonb("variables").default({}),
    preRequestScript: text("pre_request_script"),
    testScript: text("test_script"),
    tags: jsonb("tags").default([]),
    isPublic: boolean("is_public").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_testing_collections_user_id_idx").on(table.userId),
    projectIdIdx: index("api_testing_collections_project_id_idx").on(table.projectId),
    nameIdx: index("api_testing_collections_name_idx").on(table.name),
  }),
);

// API Testing Requests
export const apiTestingRequests = pgTable(
  "api_testing_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => apiTestingCollections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    method: varchar("method", { length: 10 }).notNull().default("GET"),
    url: varchar("url", { length: 2000 }).notNull(),
    headers: jsonb("headers").default({}),
    queryParams: jsonb("query_params").default({}),
    body: jsonb("body"),
    bodyType: varchar("body_type", { length: 20 }).default("json"), // json, form, raw, binary
    auth: jsonb("auth"), // type, config
    preRequestScript: text("pre_request_script"),
    testScript: text("test_script"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    collectionIdIdx: index("api_testing_requests_collection_id_idx").on(table.collectionId),
    userIdIdx: index("api_testing_requests_user_id_idx").on(table.userId),
    methodIdx: index("api_testing_requests_method_idx").on(table.method),
  }),
);

// API Testing Environments
export const apiTestingEnvironments = pgTable(
  "api_testing_environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    variables: jsonb("variables").notNull().default({}),
    isActive: boolean("is_active").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_testing_environments_user_id_idx").on(table.userId),
    isActiveIdx: index("api_testing_environments_is_active_idx").on(table.isActive),
  }),
);

// API Testing History
export const apiTestingHistory = pgTable(
  "api_testing_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => apiTestingRequests.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: varchar("method", { length: 10 }).notNull(),
    url: varchar("url", { length: 2000 }).notNull(),
    requestHeaders: jsonb("request_headers").default({}),
    requestBody: jsonb("request_body"),
    responseStatus: integer("response_status"),
    responseHeaders: jsonb("response_headers").default({}),
    responseBody: jsonb("response_body"),
    responseTime: integer("response_time"), // milliseconds
    responseSize: integer("response_size"), // bytes
    testResults: jsonb("test_results").default([]),
    executedAt: timestamp("executed_at").defaultNow(),
  },
  (table) => ({
    requestIdIdx: index("api_testing_history_request_id_idx").on(table.requestId),
    userIdIdx: index("api_testing_history_user_id_idx").on(table.userId),
    executedAtIdx: index("api_testing_history_executed_at_idx").on(table.executedAt),
  }),
);
