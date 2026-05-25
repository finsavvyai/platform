import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { instances } from './instances.js';

// ─── Integration Connections ────────────────────────────────────────────────

export const integrationConnections = sqliteTable('integration_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  integrationSlug: text('integration_slug').notNull(),
  status: text('status', {
    enum: ['connected', 'disconnected', 'error', 'pending'],
  })
    .notNull()
    .default('pending'),
  configEncrypted: text('config_encrypted'),
  lastSyncAt: text('last_sync_at'),
  eventsReceived: integer('events_received').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  lastErrorAt: text('last_error_at'),
  lastErrorMessage: text('last_error_message'),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Integration Events ─────────────────────────────────────────────────────

export const integrationEvents = sqliteTable('integration_events', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => integrationConnections.id),
  eventType: text('event_type').notNull(),
  severity: text('severity', {
    enum: ['info', 'low', 'medium', 'high', 'critical'],
  }).notNull(),
  summary: text('summary').notNull(),
  rawPayload: text('raw_payload'),
  latencyMs: integer('latency_ms'),
  processedAt: text('processed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
