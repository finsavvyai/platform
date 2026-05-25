-- Slack digest: per-project webhook URL for weekly cost summaries.
-- Nullable — only projects that opted in receive digests.

ALTER TABLE projects ADD COLUMN slack_webhook_url TEXT;
