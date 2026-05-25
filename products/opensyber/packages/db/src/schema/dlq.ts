import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── Dead Letter Queue ─────────────────────────────────────────────────────

export const deadLetterQueue = sqliteTable('dead_letter_queue', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  eventType: text('eventType').notNull(),
  payload: text('payload').notNull(),
  errorMessage: text('errorMessage').notNull(),
  retryCount: integer('retryCount').notNull().default(0),
  maxRetries: integer('maxRetries').notNull().default(3),
  nextRetryAt: text('nextRetryAt'),
  status: text('status', {
    enum: ['pending', 'retrying', 'failed', 'resolved'],
  })
    .notNull()
    .default('pending'),
  createdAt: text('createdAt').notNull(),
  lastAttemptAt: text('lastAttemptAt'),
});
