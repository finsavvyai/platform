/**
 * Webhook Delivery Logs Schema
 *
 * Tracks outbound webhook delivery attempts, status, and retry state.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const webhookDeliveryLogs = sqliteTable('webhook_delivery_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').references(() => organizations.id),
  webhookUrl: text('webhook_url').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  status: text('status', {
    enum: ['pending', 'delivered', 'failed', 'retrying'],
  }).notNull().default('pending'),
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  attemptCount: integer('attempt_count').notNull().default(1),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRetryAt: text('next_retry_at'),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
