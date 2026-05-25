// Drizzle ORM schema for cross-session MCP fingerprint persistence.

import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const toolFingerprints = sqliteTable(
  'tool_fingerprints',
  {
    serverUrl: text('server_url').notNull(),
    toolName: text('tool_name').notNull(),
    fingerprint: text('fingerprint').notNull(),
    description: text('description').notNull(),
    inputSchema: text('input_schema').notNull(),
    firstSeen: integer('first_seen').notNull(),
    lastSeen: integer('last_seen').notNull(),
  },
  (t) => [primaryKey({ columns: [t.serverUrl, t.toolName] })],
);

export const fingerprintHistory = sqliteTable(
  'fingerprint_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverUrl: text('server_url').notNull(),
    toolName: text('tool_name').notNull(),
    fingerprint: text('fingerprint').notNull(),
    description: text('description').notNull(),
    inputSchema: text('input_schema').notNull(),
    seenAt: integer('seen_at').notNull(),
  },
  (t) => [index('idx_history_server_tool').on(t.serverUrl, t.toolName, t.seenAt)],
);
