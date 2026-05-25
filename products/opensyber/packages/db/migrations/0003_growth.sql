-- Migration 0003: Growth & Onboarding
-- Adds onboarding tracking, trial management, email dedup, and referral system

-- Onboarding
ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;
ALTER TABLE users ADD COLUMN onboarding_progress TEXT;

-- Trial tracking
ALTER TABLE users ADD COLUMN trial_started_at TEXT;

-- Email dedup flags (JSON)
ALTER TABLE users ADD COLUMN email_flags TEXT;

-- Referral system
ALTER TABLE users ADD COLUMN referral_code TEXT;
CREATE UNIQUE INDEX idx_users_referral_code ON users(referral_code);
ALTER TABLE users ADD COLUMN referred_by TEXT;
ALTER TABLE users ADD COLUMN referral_credits INTEGER NOT NULL DEFAULT 0;
