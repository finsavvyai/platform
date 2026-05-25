/**
 * Webhook Type Definitions
 */

export interface WebhookConfig {
	id: string;
	tenantId: string;
	userId?: string;
	webhookUrl: string;
	webhookSecret: string;
	enabled: boolean;
	notificationMode: 'realtime' | 'digest_hourly' | 'digest_daily';
	minSeverity?: 'low' | 'medium' | 'high' | 'critical';
	categories?: string[];
	quietHoursStart?: string;
	quietHoursEnd?: string;
	quietHoursTimezone?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface WebhookEvent {
	event: 'alert.created' | 'alert.updated' | 'tenant.synced' | 'remediation.completed';
	deliveryId?: string;
	tenant: {
		id: string;
		name: string;
	};
	data: Record<string, unknown>;
	timestamp: string;
	// Platform-specific formatted data
	slack?: any;
	teams?: any;
	discord?: any;
	text?: string;
}

export interface WebhookDelivery {
	id: string;
	webhookConfigId: string;
	eventType: string;
	payload: any;
	status: 'pending' | 'delivered' | 'failed' | 'retrying';
	attempts: number;
	lastAttemptAt?: Date;
	nextRetryAt?: Date;
	responseStatus?: number;
	responseBody?: string;
	errorMessage?: string;
	createdAt: Date;
	deliveredAt?: Date;
}
