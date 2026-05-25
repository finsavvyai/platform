import type { Context, Next } from 'hono';
import type { AppEnv } from '../app/types';

/**
 * Platform Admin Authentication Middleware
 *
 * Verifies platform_admin or super_admin role and
 * logs all admin actions to the audit_logs table.
 */

const ADMIN_ROLES = ['platform_admin', 'super_admin'];

export async function platformAdminMiddleware(c: Context<AppEnv>, next: Next) {
	const userRole = c.get('userRole') ?? c.get('user')?.role ?? '';

	if (!ADMIN_ROLES.includes(String(userRole))) {
		return c.json(
			{ error: 'Forbidden', message: 'Platform admin access required' },
			403
		);
	}

	await next();
}

interface AuditEntry {
	action: string;
	resourceType?: string;
	resourceId?: string;
	details?: Record<string, unknown>;
}

export async function logAdminAction(
	c: Context<AppEnv>,
	entry: AuditEntry
): Promise<void> {
	try {
		const db = c.env.DB;
		const userId = c.get('userId') ?? c.get('user')?.sub ?? 'unknown';
		const orgId = c.get('user')?.orgId ?? null;
		const ip =
			c.req.header('cf-connecting-ip') ??
			c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
			'unknown';

		const id = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		await db
			.prepare(
				`INSERT INTO audit_logs (id, org_id, user_id, action, resource_type, resource_id, details, ip_address, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				orgId,
				userId,
				entry.action,
				entry.resourceType ?? null,
				entry.resourceId ?? null,
				entry.details ? JSON.stringify(entry.details) : null,
				ip,
				now
			)
			.run();
	} catch (err) {
		console.error('Failed to write audit log:', err);
	}
}
