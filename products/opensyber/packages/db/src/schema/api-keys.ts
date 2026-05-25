import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { instances } from './instances.js';

// ─── API Keys ──────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  instanceId: text('instance_id').references(() => instances.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(),
  scopes: text('scopes').notNull().default('["ingest"]'),
  rateLimit: integer('rate_limit').default(100),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
