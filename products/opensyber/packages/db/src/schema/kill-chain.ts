/**
 * Kill Chain DB Schema
 *
 * Tables for storing kill chain rules and unified incidents
 * created by the correlation engine.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const killChainRules = sqliteTable('kill_chain_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stages: text('stages').notNull(), // JSON array of stages
  timeWindowMinutes: integer('time_window_minutes').notNull(),
  severity: text('severity', {
    enum: ['high', 'critical'],
  })
    .notNull()
    .default('critical'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const killChainIncidents = sqliteTable('kill_chain_incidents', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => killChainRules.id),
  userId: text('user_id').references(() => users.id),
  severity: text('severity', {
    enum: ['high', 'critical'],
  }).notNull(),
  status: text('status', {
    enum: ['open', 'investigating', 'resolved'],
  })
    .notNull()
    .default('open'),
  correlatedEventIds: text('correlated_event_ids').notNull(), // JSON array of event IDs
  summary: text('summary').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
});
