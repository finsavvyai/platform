import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─── Enterprise Leads ───────────────────────────────────────────────────────

export const enterpriseLeads = sqliteTable('enterprise_leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company').notNull(),
  message: text('message').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const trustFunnelEvents = sqliteTable('trust_funnel_events', {
  id: text('id').primaryKey(),
  event: text('event').notNull(),
  instanceId: text('instance_id'),
  instanceName: text('instance_name'),
  score: integer('score'),
  grade: text('grade'),
  path: text('path').notNull(),
  occurredAt: text('occurred_at').notNull(),
  sessionId: text('session_id').notNull(),
  source: text('source'),
  medium: text('medium'),
  campaign: text('campaign'),
  ref: text('ref'),
  referrerHost: text('referrer_host'),
  landingPath: text('landing_path'),
  firstSeenAt: text('first_seen_at'),
  userAgent: text('user_agent'),
  countryCode: text('country_code'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
