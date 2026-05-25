-- Add auth_method column to users table if it doesn't exist (for test DB schema sync)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'email';
