import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { skills } from './instances.js';
import { users } from './users.js';

// ─── Skill Publishers ───────────────────────────────────────────────────────────

export const skillPublishers = sqliteTable('skill_publishers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  website: text('website'),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  revenueSharePct: integer('revenue_share_pct').notNull().default(70),
  payoutEmail: text('payout_email'),
  payoutMethod: text('payout_method', { enum: ['stripe', 'paypal', 'wire'] }),
  totalEarningsCents: integer('total_earnings_cents').notNull().default(0),
  status: text('status', { enum: ['active', 'suspended', 'banned'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Third-Party Skills ─────────────────────────────────────────────────────────

export const thirdPartySkills = sqliteTable('third_party_skills', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull().references(() => skillPublishers.id, { onDelete: 'cascade' }),
  skillId: text('skill_id').notNull().references(() => skills.id),
  sourceRepo: text('source_repo'),
  reviewStatus: text('review_status', {
    enum: ['pending', 'in_review', 'approved', 'rejected', 'revoked'],
  }).notNull().default('pending'),
  securityScanPassed: integer('security_scan_passed', { mode: 'boolean' }).notNull().default(false),
  scanReport: text('scan_report'), // JSON
  submittedAt: text('submitted_at').notNull().default(sql`(datetime('now'))`),
  approvedAt: text('approved_at'),
  reviewedBy: text('reviewed_by'),
});

// ─── Skill Revenue Events ───────────────────────────────────────────────────────

export const skillRevenueEvents = sqliteTable('skill_revenue_events', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id),
  publisherId: text('publisher_id').notNull().references(() => skillPublishers.id),
  eventType: text('event_type', {
    enum: ['purchase', 'subscription', 'refund', 'chargeback'],
  }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  platformFeeCents: integer('platform_fee_cents').notNull().default(0),
  publisherShareCents: integer('publisher_share_cents').notNull().default(0),
  buyerUserId: text('buyer_user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Skill Payouts ──────────────────────────────────────────────────────────────

export const skillPayouts = sqliteTable('skill_payouts', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull().references(() => skillPublishers.id),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  totalRevenueCents: integer('total_revenue_cents').notNull().default(0),
  payoutAmountCents: integer('payout_amount_cents').notNull().default(0),
  platformFeeCents: integer('platform_fee_cents').notNull().default(0),
  status: text('status', { enum: ['pending', 'processing', 'paid', 'failed'] }).notNull().default('pending'),
  payoutRef: text('payout_ref'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
