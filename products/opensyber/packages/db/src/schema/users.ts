import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Users ──────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  plan: text('plan', { enum: ['free', 'personal', 'pro', 'team'] })
    .notNull()
    .default('free'),
  lemonSqueezyCustomerId: text('lemonsqueezy_customer_id'),
  lemonSqueezySubscriptionId: text('lemonsqueezy_subscription_id'),
  onboardingCompletedAt: text('onboarding_completed_at'),
  onboardingProgress: text('onboarding_progress'), // JSON
  onboardingProfile: text('onboarding_profile'), // JSON — @opensyber/shared OnboardingProfile
  trialStartedAt: text('trial_started_at'),
  emailFlags: text('email_flags'), // JSON
  paymentGraceUntil: text('payment_grace_until'),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  referralCredits: integer('referral_credits').notNull().default(0),
  isAdmin: integer('is_admin').notNull().default(0),
  isSuspended: integer('is_suspended').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Credentials (Vault) ─────────────────────────────────────────────────────

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  instanceId: text('instance_id').notNull(),
  key: text('key').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
