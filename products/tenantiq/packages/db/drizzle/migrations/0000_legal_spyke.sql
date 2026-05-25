CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"business_impact" text,
	"affected_resources" jsonb DEFAULT '[]'::jsonb,
	"recommended_action" text,
	"remediation_type" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"details" jsonb,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "licenses_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku_id" text NOT NULL,
	"sku_name" text NOT NULL,
	"total" integer NOT NULL,
	"assigned" integer NOT NULL,
	"cost_per_unit" numeric(10, 2),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"billing_plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"azure_oid" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "platform_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "remediation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_id" uuid,
	"action_id" text NOT NULL,
	"executed_by" text NOT NULL,
	"status" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now(),
	"rollback_available" boolean DEFAULT true,
	"rollback_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"azure_tenant_id" text NOT NULL,
	"display_name" text NOT NULL,
	"domain" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tenants_azure_tenant_id_unique" UNIQUE("azure_tenant_id")
);
--> statement-breakpoint
CREATE TABLE "users_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"azure_user_id" text NOT NULL,
	"display_name" text,
	"email" text,
	"user_type" text,
	"account_enabled" boolean,
	"last_sign_in" timestamp with time zone,
	"last_non_interactive_sign_in" timestamp with time zone,
	"assigned_licenses" jsonb DEFAULT '[]'::jsonb,
	"assigned_groups" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid,
	"tenant_id" uuid NOT NULL,
	"status" text NOT NULL,
	"steps_completed" integer DEFAULT 0,
	"steps_total" integer NOT NULL,
	"results" jsonb,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"approved_by" text
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"workflow_type" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb,
	"steps" jsonb NOT NULL,
	"requires_approval" boolean DEFAULT false,
	"enabled" boolean DEFAULT true,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses_cache" ADD CONSTRAINT "licenses_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_log" ADD CONSTRAINT "remediation_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediation_log" ADD CONSTRAINT "remediation_log_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_cache" ADD CONSTRAINT "users_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alerts_tenant_status" ON "alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_alerts_tenant_severity" ON "alerts" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "idx_audit_log_tenant_created" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_licenses_cache_tenant_sku" ON "licenses_cache" USING btree ("tenant_id","sku_id");--> statement-breakpoint
CREATE INDEX "idx_remediation_tenant_status" ON "remediation_log" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_cache_tenant_azure" ON "users_cache" USING btree ("tenant_id","azure_user_id");--> statement-breakpoint
CREATE INDEX "idx_users_cache_tenant_signin" ON "users_cache" USING btree ("tenant_id","last_sign_in");