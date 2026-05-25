CREATE TABLE `test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`type` text DEFAULT 'Functional' NOT NULL,
	`jira_issue` text,
	`description` text,
	`test_code` text,
	`test_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
