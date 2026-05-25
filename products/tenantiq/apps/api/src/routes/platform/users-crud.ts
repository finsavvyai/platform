import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.middleware';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc, type SQL } from 'drizzle-orm';
import type { AppEnv } from '../../index';

/**
 * Validation Schemas (exported for use by other user route modules)
 */
export const createUserSchema = z.object({
	organizationId: z.string().optional(),
	email: z.string().email(),
	name: z.string().min(1),
	role: z.enum(['platform_admin', 'tenant_admin', 'tenant_operator', 'tenant_viewer']),
	password: z.string().min(8).optional(),
	sendInvitation: z.boolean().default(true),
});

export const updateUserSchema = z.object({
	name: z.string().min(1).optional(),
	role: z.enum(['platform_admin', 'tenant_admin', 'tenant_operator', 'tenant_viewer']).optional(),
	status: z.enum(['active', 'suspended', 'deleted']).optional(),
});

const usersCrud = new Hono<AppEnv>();

/**
 * GET / — List all platform and tenant users (Platform admin only)
 */
usersCrud.get('/', requireRole('platform_admin', 'super_admin', 'admin'), async (c) => {
	const db = getDb(c.env);

	const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
	const offset = parseInt(c.req.query('offset') || '0');
	const organizationId = c.req.query('organizationId');
	const role = c.req.query('role');
	const status = c.req.query('status');

	try {
		const conditions: SQL<unknown>[] = [];

		if (organizationId) {
			conditions.push(eq(schema.platformUsers.organizationId, organizationId));
		}
		if (role) {
			conditions.push(eq(schema.platformUsers.role, role));
		}
		if (status) {
			conditions.push(eq(schema.platformUsers.status, status));
		}

		const allUsers = await db
			.select()
			.from(schema.platformUsers)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(schema.platformUsers.createdAt))
			.limit(limit)
			.offset(offset);

		return c.json({
			users: allUsers.map(u => ({
				...u,
				passwordHash: undefined,
				twoFactorSecret: undefined,
			})),
			total: allUsers.length,
			limit,
			offset,
		});
	} catch (error) {
		console.error('Failed to list users:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * GET /:userId — Get user details
 */
usersCrud.get('/:userId', async (c) => {
	const db = getDb(c.env);
	const userId = c.req.param('userId');
	const currentUser = c.get('user');

	try {
		const user = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.id, userId))
			.limit(1);

		if (user.length === 0) {
			return c.json({ error: 'Not Found', message: 'User not found' }, 404);
		}

		if (currentUser.role !== 'platform_admin') {
			if (user[0].organizationId !== currentUser.orgId && user[0].id !== currentUser.sub) {
				return c.json({ error: 'Forbidden', message: 'Access denied' }, 403);
			}
		}

		return c.json({
			user: {
				...user[0],
				passwordHash: undefined,
				twoFactorSecret: undefined,
			},
		});
	} catch (error) {
		console.error('Failed to fetch user:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default usersCrud;
