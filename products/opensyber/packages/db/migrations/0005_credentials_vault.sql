-- Credentials vault for storing encrypted secrets per instance
CREATE TABLE IF NOT EXISTS `credentials` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `instance_id` text NOT NULL REFERENCES `instances`(`id`),
  `key` text NOT NULL,
  `encrypted_value` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX `idx_credentials_user_instance` ON `credentials` (`user_id`, `instance_id`);
CREATE UNIQUE INDEX `idx_credentials_unique_key` ON `credentials` (`user_id`, `instance_id`, `key`);
