-- 019_teams_webhook.sql
-- Add Microsoft Teams Incoming Webhook URL to projects.
-- URL is validated at the application layer (must match *.webhook.office.com or *.webhook.office.us).

ALTER TABLE projects ADD COLUMN teams_webhook_url TEXT;
