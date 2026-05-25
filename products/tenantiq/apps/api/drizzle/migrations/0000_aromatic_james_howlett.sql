CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text NOT NULL,
	`last_used_at` text,
	`usage_count` integer DEFAULT 0,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`revoked_at` text,
	`revoked_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_api_keys_organization` ON `api_keys` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_prefix` ON `api_keys` (`key_prefix`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`invited_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`accepted_by` text,
	`revoked_at` text,
	`revoked_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitations_token` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitations_org_email` ON `invitations` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_invitations_status` ON `invitations` (`status`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`tax` integer DEFAULT 0,
	`total` integer NOT NULL,
	`amount_paid` integer DEFAULT 0,
	`amount_due` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`line_items` text NOT NULL,
	`payment_method` text,
	`stripe_invoice_id` text,
	`pdf_url` text,
	`created_at` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_invoices_organization` ON `invoices` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_invoices_due_date` ON `invoices` (`due_date`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`domain` text,
	`primary_contact_email` text NOT NULL,
	`primary_contact_name` text,
	`phone` text,
	`address_line_1` text,
	`address_line_2` text,
	`city` text,
	`state` text,
	`zip_code` text,
	`country` text,
	`subscription_tier` text DEFAULT 'starter' NOT NULL,
	`subscription_status` text DEFAULT 'trial' NOT NULL,
	`billing_email` text,
	`azure_tenant_id` text,
	`azure_client_id` text,
	`azure_client_secret_encrypted` text,
	`graph_api_enabled` integer DEFAULT 0,
	`last_synced_at` text,
	`logo_url` text,
	`website_url` text,
	`industry` text,
	`company_size` text,
	`max_users` integer DEFAULT 25,
	`max_scans_per_month` integer DEFAULT 100,
	`max_alerts` integer DEFAULT 1000,
	`max_storage_gb` integer DEFAULT 10,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`trial_started_at` text,
	`trial_ends_at` text,
	`settings` text,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organizations_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organizations_status` ON `organizations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_organizations_subscription_status` ON `organizations` (`subscription_status`);--> statement-breakpoint
CREATE TABLE `platform_users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`password_hash` text,
	`email_verified` integer DEFAULT 0,
	`email_verified_at` text,
	`auth_provider` text DEFAULT 'email',
	`auth_provider_id` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`last_active_at` text,
	`timezone` text DEFAULT 'UTC',
	`locale` text DEFAULT 'en',
	`two_factor_enabled` integer DEFAULT 0,
	`two_factor_secret` text,
	`created_at` text NOT NULL,
	`created_by` text,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`invited_at` text,
	`invited_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_users_email_unique` ON `platform_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_email` ON `platform_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_organization` ON `platform_users` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_role` ON `platform_users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_status` ON `platform_users` (`status`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`tier` text NOT NULL,
	`status` text NOT NULL,
	`monthly_price` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_interval` text DEFAULT 'monthly' NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`cancel_at_period_end` integer DEFAULT 0,
	`cancelled_at` text,
	`payment_method` text,
	`last_payment_status` text,
	`last_payment_date` text,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`max_users` integer NOT NULL,
	`max_scans_per_month` integer NOT NULL,
	`max_alerts` integer NOT NULL,
	`max_storage_gb` integer NOT NULL,
	`features` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `idx_subscriptions_organization` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_period_end` ON `subscriptions` (`current_period_end`);--> statement-breakpoint
CREATE TABLE `usage_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`scans_executed` integer DEFAULT 0,
	`alerts_generated` integer DEFAULT 0,
	`remediations_executed` integer DEFAULT 0,
	`api_calls_count` integer DEFAULT 0,
	`storage_used_mb` integer DEFAULT 0,
	`m365_users_monitored` integer DEFAULT 0,
	`m365_licenses_tracked` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `idx_usage_metrics_org_period` ON `usage_metrics` (`organization_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `intelligence_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`scan_type` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`findings_count` integer DEFAULT 0,
	`alerts_created` integer DEFAULT 0,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `user_activity_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_sign_in` text,
	`last_exchange_activity` text,
	`last_teams_activity` text,
	`last_sharepoint_activity` text,
	`assigned_licenses` text,
	`license_cost_monthly` integer,
	`snapshot_date` text NOT NULL,
	`activity_score` integer
);
--> statement-breakpoint
CREATE TABLE `alert_history` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`action` text NOT NULL,
	`performed_by` text NOT NULL,
	`performed_at` text NOT NULL,
	`notes` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	`resolved_by` text,
	`resolution_notes` text,
	`estimated_cost_impact` integer,
	`estimated_risk_score` integer,
	`affected_users` integer,
	`resource_id` text,
	`resource_type` text,
	`metadata` text,
	`recommendations` text,
	`can_auto_remediate` integer DEFAULT 0,
	`auto_remediation_action` text
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_tenant_status` ON `alerts` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_alerts_severity` ON `alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_alerts_created_at` ON `alerts` (`created_at`);--> statement-breakpoint
CREATE TABLE `remediation_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`remediation_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`result` text
);
--> statement-breakpoint
CREATE TABLE `remediations` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`action_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`initiated_by` text NOT NULL,
	`initiated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`target_resource_id` text NOT NULL,
	`target_resource_type` text NOT NULL,
	`action_parameters` text,
	`success` integer DEFAULT 0,
	`error_message` text,
	`steps_completed` text,
	`can_rollback` integer DEFAULT 1,
	`rollback_data` text,
	`rolled_back_at` text,
	`rolled_back_by` text
);
--> statement-breakpoint
CREATE TABLE `workflow_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger_type` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`steps_total` integer,
	`steps_completed` integer,
	`steps_failed` integer,
	`result` text,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`schedule` text,
	`enabled` integer DEFAULT 1,
	`parameters` text,
	`conditions` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_executed_at` text,
	`next_execution_at` text
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`resource_id` text,
	`resource_type` text,
	`action` text NOT NULL,
	`result` text NOT NULL,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`timestamp` text NOT NULL,
	`compliance_category` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_tenant_timestamp` ON `audit_logs` (`tenant_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_audit_event_type` ON `audit_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_resource` ON `audit_logs` (`resource_id`);--> statement-breakpoint
CREATE TABLE `report_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`generated_at` text NOT NULL,
	`generated_by` text NOT NULL,
	`status` text NOT NULL,
	`file_url` text,
	`row_count` integer,
	`file_size` integer
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`format` text NOT NULL,
	`schedule` text,
	`parameters` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`last_generated_at` text
);
