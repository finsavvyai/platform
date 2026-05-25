import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { getDb, schema } from './db';

interface AuditEntry {
	tenantId: string;
	eventType: string;
	actorId: string;
	actorType: 'user' | 'system' | 'workflow';
	resourceId?: string;
	resourceType?: string;
	action: string;
	result: 'success' | 'failed';
	details?: Record<string, unknown>;
	complianceCategory?: string;
}

/**
 * Write an audit log entry. Non-blocking — errors are logged but
 * never propagated so the caller's request is not interrupted.
 */
export async function writeAuditLog(
	c: Context<AppEnv>,
	entry: AuditEntry,
): Promise<void> {
	try {
		const db = getDb(c.env);
		const id = crypto.randomUUID();
		await db.insert(schema.auditLogs).values({
			id,
			tenantId: entry.tenantId,
			eventType: entry.eventType,
			actorId: entry.actorId,
			actorType: entry.actorType,
			resourceId: entry.resourceId ?? null,
			resourceType: entry.resourceType ?? null,
			action: entry.action,
			result: entry.result,
			details: entry.details ? JSON.stringify(entry.details) : null,
			ipAddress: c.req.header('cf-connecting-ip') ?? null,
			userAgent: c.req.header('user-agent') ?? null,
			timestamp: new Date().toISOString(),
			complianceCategory: entry.complianceCategory ?? null,
		});
	} catch (err) {
		console.error('Failed to write audit log:', err);
	}
}
