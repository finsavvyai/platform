-- user_onboarding: persists the Day 1 / Week 1 / Month 1 checklist state
-- per user. Written by /api/onboarding/progress/:stepId/complete.
-- Schema lives in src/db/schema.ts → userOnboarding.

CREATE TABLE IF NOT EXISTS user_onboarding (
    user_id TEXT PRIMARY KEY NOT NULL,
    completed_steps TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_onboarding_updated_at_idx ON user_onboarding(updated_at);
