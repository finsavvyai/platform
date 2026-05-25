CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`passed_tests` integer DEFAULT 0 NOT NULL,
	`failed_tests` integer DEFAULT 0 NOT NULL,
	`skipped_tests` integer DEFAULT 0 NOT NULL,
	`total_tests` integer DEFAULT 0 NOT NULL,
	`start_time` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recording_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`interaction_count` integer DEFAULT 0 NOT NULL,
	`framework` text DEFAULT 'playwright' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`subscription` text DEFAULT 'free' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `virtual_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`url_path` text NOT NULL,
	`status` integer DEFAULT 200 NOT NULL,
	`json_body` text,
	`headers` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);