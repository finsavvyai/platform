import { z } from 'zod';
import { schema } from '../../lib/db';

export const webhookConfigSchema = z.object({
	webhookUrl: z.string().url(),
	webhookSecret: z.string().min(16),
	enabled: z.boolean().default(true),
	notificationMode: z.enum(['realtime', 'digest']).default('realtime'),
	minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	categories: z.array(z.string()).default([]),
	quietHoursStart: z.string().optional(),
	quietHoursEnd: z.string().optional()
});

export function parseCategories(value: unknown): string[] {
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

export function serializeCategories(categories: string[]): string {
	return JSON.stringify(categories);
}

type TestWebhookConfig = Pick<typeof schema.webhookConfigs.$inferSelect, 'webhookUrl' | 'webhookSecret'>;

async function createHmacSignature(secret: string, payload: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function sendSignedTestWebhook(config: TestWebhookConfig, tenantId: string): Promise<{
	ok: boolean;
	status: number;
	error?: string;
}> {
	const payload = {
		event: 'webhook.test',
		tenantId,
		data: {
			message: 'This is a test webhook from TenantIQ',
			timestamp: new Date().toISOString()
		},
		timestamp: new Date().toISOString()
	};

	const body = JSON.stringify(payload);
	const signature = await createHmacSignature(config.webhookSecret, body);
	const response = await fetch(config.webhookUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-TenantIQ-Signature': signature,
			'X-TenantIQ-Event': 'webhook.test'
		},
		body
	});

	if (response.ok) {
		return { ok: true, status: response.status };
	}

	return {
		ok: false,
		status: response.status,
		error: await response.text()
	};
}
