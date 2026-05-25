-- Fix CHECK constraint on users.plan to include 'free' tier
-- Original: CHECK (plan IN ('personal','pro','team'))
-- Fixed:    CHECK (plan IN ('free','personal','pro','team'))
--
-- IMPORTANT: Uses create-new/copy/drop-old/rename pattern (not rename-old)
-- because D1 has PRAGMA foreign_keys = ON, and ALTER TABLE RENAME propagates
-- to FK references in dependent tables.

-- 1. Create new table with corrected CHECK
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'personal', 'pro', 'team')),
  lemonsqueezy_customer_id TEXT,
  lemonsqueezy_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  onboarding_completed_at TEXT,
  onboarding_progress TEXT,
  trial_started_at TEXT,
  email_flags TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_credits INTEGER NOT NULL DEFAULT 0,
  payment_grace_until TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT 0
);

-- 2. Copy existing data
INSERT INTO users_new SELECT * FROM users;

-- 3. Drop old table (DDL is not blocked by FK enforcement)
DROP TABLE users;

-- 4. Rename new table to users (no FK refs point to users_new, so safe)
ALTER TABLE users_new RENAME TO users;
