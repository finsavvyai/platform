import type { Context } from 'hono';
import type { WebhookConfig, WebhookEvent } from '@tenantiq/webhooks';
import type { AppEnv } from '../../app/types';
import { schema } from '../../lib/db';

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21600];

function parseCategories(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item));
	}
	if (typeof value === 'string' && value.trim().length > 0) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) {
				return parsed.map((item) => String(item));
			}
		} catch {
			return [];
		}
	}
	return [];
}

function normalizeNotificationMode(value: string | null): WebhookConfig['notificationMode'] {
	if (value === 'digest' || value === 'digest_daily') {
		return 'digest_daily';
	}
	if (value === 'digest_hourly') {
		return 'digest_hourly';
	}
	return 'realtime';
}

export function toWebhookConfig(config: typeof schema.webhookConfigs.$inferSelect): WebhookConfig {
	return {
		id: config.id,
		tenantId: config.tenantId,
		userId: config.userId || undefined,
		webhookUrl: config.webhookUrl,
		webhookSecret: config.webhookSecret,
		enabled: Boolean(config.enabled),
		notificationMode: normalizeNotificationMode(config.notificationMode),
		minSeverity: (config.minSeverity || undefined) as WebhookConfig['minSeverity'],
		categories: parseCategories(config.categories),
		quietHoursStart: config.quietHoursStart || undefined,
		quietHoursEnd: config.quietHoursEnd || undefined,
		quietHoursTimezone: config.quietHoursTimezone || undefined,
		createdAt: new Date(config.createdAt),
		updatedAt: new Date(config.updatedAt),
	};
}

export function toWebhookEvent(payload: Record<string, unknown>, eventType: string): WebhookEvent {
	const tenantId = typeof payload.tenantId === 'string'
		? payload.tenantId
		: typeof payload.tenant === 'object' && payload.tenant !== null && typeof (payload.tenant as Record<string, unknown>).id === 'string'
			? String((payload.tenant as Record<string, unknown>).id)
			: '';
	const tenantName = typeof payload.tenant === 'object' && payload.tenant !== null && typeof (payload.tenant as Record<string, unknown>).name === 'string'
		? String((payload.tenant as Record<string, unknown>).name)
		: 'TenantIQ Tenant';
	const data = (typeof payload.data === 'object' && payload.data !== null)
		? (payload.data as Record<string, unknown>)
		: {};
	const timestamp = typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();

	return {
		event: eventType as WebhookEvent['event'],
		tenant: { id: tenantId, name: tenantName },
		data,
		timestamp,
	};
}

export function extractTenantId(payload: Record<string, unknown>): string | null {
	if (typeof payload.tenantId === 'string' && payload.tenantId.length > 0) {
		return payload.tenantId;
	}
	if (typeof payload.tenant === 'object' && payload.tenant !== null) {
		const tenant = payload.tenant as Record<string, unknown>;
		if (typeof tenant.id === 'string' && tenant.id.length > 0) {
			return tenant.id;
		}
	}
	return null;
}

export function getNextRetryAt(attempts: number): string | null {
	const index = Math.max(0, attempts - 1);
	const delaySeconds = RETRY_DELAYS_SECONDS[index];
	if (!delaySeconds) {
		return null;
	}
	return new Date(Date.now() + (delaySeconds * 1000)).toISOString();
}

export function requireServiceKey(c: Context<AppEnv>): Response | null {
	const configuredServiceKey = c.env.OPENCLAW_SERVICE_KEY;
	if (!configuredServiceKey) {
		// Fail closed — refuse to serve if the service key is not configured.
		return c.json({ error: 'Service key not configured' }, 503);
	}

	const providedServiceKey = c.req.header('x-openclaw-service-key');
	if (!providedServiceKey || providedServiceKey.length !== configuredServiceKey.length) {
		return c.json({ error: 'Unauthorized', message: 'Missing or invalid service key' }, 401);
	}

	// Constant-time compare.
	let diff = 0;
	for (let i = 0; i < configuredServiceKey.length; i++) {
		diff |= configuredServiceKey.charCodeAt(i) ^ providedServiceKey.charCodeAt(i);
	}
	if (diff !== 0) {
		return c.json({ error: 'Unauthorized', message: 'Missing or invalid service key' }, 401);
	}

	return null;
}
