-- Add email column to users table for failure notifications.
-- OAuth flows (GitHub, Google, GitLab, etc.) populate this on login.
ALTER TABLE users ADD COLUMN email TEXT;
