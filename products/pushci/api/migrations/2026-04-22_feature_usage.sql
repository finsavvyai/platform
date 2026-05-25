-- Per-user per-feature per-month usage counters. Used to enforce plan
-- limits on metered features (cloud_schedules count, ai_edit calls, etc).
-- Resets naturally by inserting a new period row each calendar month.

CREATE TABLE IF NOT EXISTS feature_usage (
  user_id  TEXT NOT NULL,
  feature  TEXT NOT NULL,
  period   TEXT NOT NULL, -- YYYY-MM
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature, period)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user ON feature_usage(user_id);
