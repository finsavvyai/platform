/**
 * AI Intelligence Schema
 *
 * Tables for AI-generated insights, recommendations, and NL query history.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const aiInsights = sqliteTable('ai_insights', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // threat, compliance, anomaly, recommendation
  severity: text('severity').notNull(), // critical, high, medium, low, info
  title: text('title').notNull(),
  description: text('description').notNull(),
  sourceType: text('source_type').notNull(), // agent_activity, cspm, saas, rotation
  sourceId: text('source_id'),
  status: text('status').notNull().default('new'), // new, reviewed, dismissed
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const aiRecommendations = sqliteTable('ai_recommendations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  insightId: text('insight_id').references(() => aiInsights.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  priority: integer('priority').notNull().default(0),
  status: text('status').notNull().default('pending'), // pending, applied, skipped
  appliedAt: text('applied_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const aiQueryHistory = sqliteTable('ai_query_history', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  translatedFilter: text('translated_filter').notNull(), // JSON filter object
  resultCount: integer('result_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
