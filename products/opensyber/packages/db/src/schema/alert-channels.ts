import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const alertChannels = sqliteTable('alert_channels', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  channelType: text('channel_type', {
    enum: ['email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord'],
  }).notNull(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  minSeverity: text('min_severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull().default('medium'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
