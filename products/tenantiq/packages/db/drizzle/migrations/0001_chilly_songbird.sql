CREATE TABLE "webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"webhook_url" text NOT NULL,
	"webhook_secret" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"notification_mode" text DEFAULT 'realtime',
	"min_severity" text,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"quiet_hours_timezone" text DEFAULT 'UTC',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_config_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_config_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_tenant" ON "webhook_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_user" ON "webhook_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_config" ON "webhook_deliveries" USING btree ("webhook_config_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_next_retry" ON "webhook_deliveries" USING btree ("next_retry_at");