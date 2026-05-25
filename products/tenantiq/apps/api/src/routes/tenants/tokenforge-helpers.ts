/**
 * TokenForge shared helpers — ID generation, event logging, and Zod schemas.
 */
import { z } from 'zod';

export function genId() {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

export async function logTfEvent(
	db: D1Database,
	orgId: string,
	tenantId: string,
	eventType: string,
	userId?: string,
	fingerprint?: string,
	metadata?: Record<string, unknown>,
) {
	await db
		.prepare(
			`INSERT INTO tokenforge_events (id, org_id, tenant_id, user_id, event_type, device_fingerprint, metadata, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(genId(), orgId, tenantId, userId ?? null, eventType, fingerprint ?? null, metadata ? JSON.stringify(metadata) : null, Date.now())
		.run()
		.catch(() => null);
}

export const setupSchema = z.object({
	enforceMode: z.enum(['monitor', 'enforce', 'strict']).default('monitor'),
	maxDevicesPerUser: z.number().int().min(1).max(20).default(5),
	bindingTtlDays: z.number().int().min(1).max(365).default(90),
	autoRevokeOnRisk: z.boolean().default(true),
});

export const bindDeviceSchema = z.object({
	deviceFingerprint: z.string().min(8).max(512),
	deviceName: z.string().max(120).optional(),
	publicKeyHash: z.string().min(16).max(512),
});

export const validateSchema = z.object({
	deviceFingerprint: z.string().min(8).max(512),
	publicKeyHash: z.string().min(16).max(512),
});
