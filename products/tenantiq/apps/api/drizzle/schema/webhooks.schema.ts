import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Webhook Schemas (D1)
 *
 * Local API ownership of webhook tables avoids cross-dialect type drift
 * between D1 route code and PostgreSQL package schemas.
 */

export const webhookConfigs = sqliteTable(
	'webhook_configs',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		userId: text('user_id'),
		webhookUrl: text('webhook_url').notNull(),
		webhookSecret: text('webhook_secret').notNull(),
		enabled: integer('enabled').default(1),
		notificationMode: text('notification_mode').default('realtime'),
		minSeverity: text('min_severity'),
		categories: text('categories').default('[]'),
		quietHoursStart: text('quiet_hours_start'),
		quietHoursEnd: text('quiet_hours_end'),
		quietHoursTimezone: text('quiet_hours_timezone').default('UTC'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_webhook_configs_tenant').on(table.tenantId),
		index('idx_webhook_configs_user').on(table.userId),
	]
);

export const webhookDeliveries = sqliteTable(
	'webhook_deliveries',
	{
		id: text('id').primaryKey(),
		webhookConfigId: text('webhook_config_id').notNull(),
		eventType: text('event_type').notNull(),
		payload: text('payload').notNull(),
		status: text('status').default('pending'),
		attempts: integer('attempts').default(0),
		lastAttemptAt: text('last_attempt_at'),
		nextRetryAt: text('next_retry_at'),
		responseStatus: integer('response_status'),
		responseBody: text('response_body'),
		errorMessage: text('error_message'),
		createdAt: text('created_at').notNull(),
		deliveredAt: text('delivered_at'),
	},
	(table) => [
		index('idx_webhook_deliveries_config').on(table.webhookConfigId),
		index('idx_webhook_deliveries_status').on(table.status),
		index('idx_webhook_deliveries_next_retry').on(table.nextRetryAt),
	]
);
