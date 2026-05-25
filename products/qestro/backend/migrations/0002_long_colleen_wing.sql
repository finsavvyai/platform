CREATE TABLE `virtual_service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`virtual_service_id` text,
	`method` text NOT NULL,
	`url` text NOT NULL,
	`headers` text,
	`body` text,
	`query_params` text,
	`absolute_url` text NOT NULL,
	`was_matched` integer DEFAULT false NOT NULL,
	`timing_total` integer DEFAULT 0 NOT NULL,
	`timing_serve` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`virtual_service_id`) REFERENCES `virtual_services`(`id`) ON UPDATE no action ON DELETE no action
);
