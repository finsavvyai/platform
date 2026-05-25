-- TokenForge: add `name` column to tf_webhook_config so tenants can register
-- multiple webhooks per tenant and label them (e.g. "staging", "prod").
-- Existing rows default to '' which the application coerces to the first
-- 8 chars of the host name for display.

ALTER TABLE tf_webhook_config ADD COLUMN name TEXT NOT NULL DEFAULT '';
