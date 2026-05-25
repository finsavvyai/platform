-- Email digest: per-project recipient address. Reuses the same weekly
-- cron as Slack — either or both can be configured.

ALTER TABLE projects ADD COLUMN digest_email TEXT;
