CREATE TABLE `user_onboarding` (
	`user_id` text PRIMARY KEY NOT NULL,
	`completed_steps` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
