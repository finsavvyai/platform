import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { requireRole } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { hashPassword } from '../../lib/auth';
import { createUserSchema, updateUserSchema } from './users-crud';
import { createInvitation } from './users-invite-helper';
import usersDelete from './users-delete';

const usersWrite = new Hono<AppEnv>();
usersWrite.route('/', usersDelete);

/** POST / — Create a new user (Platform admin only) */
usersWrite.post('/', requireRole('platform_admin', 'super_admin', 'admin'), validateBody(createUserSchema), async (c) => {
	const db = getDb(c.env);
	const currentUser = c.get('user');
	// Use the Zod-validated payload from the middleware; never re-read raw JSON.
	const data = c.get('validatedBody') as {
		organizationId?: string;
		email: string;
		name: string;
		role: 'platform_admin' | 'tenant_admin' | 'tenant_operator' | 'tenant_viewer';
		password?: string;
		sendInvitation: boolean;
	};

	try {
		if (data.organizationId) {
			const org = await db
				.select()
				.from(schema.organizations)
				.where(eq(schema.organizations.id, data.organizationId))
				.limit(1);

			if (org.length === 0) {
				return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
			}
		}

		const existing = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.email, data.email))
			.limit(1);

		if (existing.length > 0) {
			return c.json({
				error: 'Conflict',
				message: 'A user with this email already exists',
			}, 409);
		}

		const now = new Date().toISOString();
		const userId = nanoid();

		const user = {
			id: userId,
			organizationId: data.organizationId || null,
			email: data.email,
			name: data.name,
			role: data.role,
			passwordHash: data.password ? await hashPassword(data.password) : null,
			status: data.sendInvitation ? 'invited' : 'active',
			emailVerified: 0,
			createdAt: now,
			createdBy: currentUser.sub,
			updatedAt: now,
			invitedAt: data.sendInvitation ? now : null,
			invitedBy: data.sendInvitation ? currentUser.sub : null,
		};

		await db.insert(schema.platformUsers).values(user);

		if (data.sendInvitation) {
			await createInvitation(c.env, {
				email: data.email,
				role: data.role,
				organizationId: data.organizationId || '',
				invitedBy: currentUser.sub,
				invitedAt: now,
			});
		}

		return c.json({
			user: {
				...user,
				passwordHash: undefined,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to create user:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/** PATCH /:userId — Update a user */
usersWrite.patch('/:userId', validateBody(updateUserSchema), async (c) => {
	const db = getDb(c.env);
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const currentUser = c.get('user');
	// Only accept the whitelisted fields from the validated body — never spread raw JSON.
	const validated = c.get('validatedBody') as {
		name?: string;
		role?: 'platform_admin' | 'tenant_admin' | 'tenant_operator' | 'tenant_viewer';
		status?: 'active' | 'suspended' | 'deleted';
	};

	try {
		const existing = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.id, userId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'User not found' }, 404);
		}

		// Non-admins can only edit themselves AND must match their own org.
		if (currentUser.role !== 'platform_admin') {
			const outsideOrg = existing[0].organizationId !== currentUser.orgId;
			const notSelf = existing[0].id !== currentUser.sub;
			if (outsideOrg || notSelf) {
				return c.json({ error: 'Forbidden', message: 'Access denied' }, 403);
			}
			// Non-admins cannot change role — only their own name.
			if (validated.role !== undefined || validated.status !== undefined) {
				return c.json({ error: 'Forbidden', message: 'Cannot change role or status' }, 403);
			}
		}

		const now = new Date().toISOString();
		const updateSet: Record<string, unknown> = { updatedAt: now };
		if (validated.name !== undefined) updateSet.name = validated.name;
		if (validated.role !== undefined) updateSet.role = validated.role;
		if (validated.status !== undefined) updateSet.status = validated.status;

		await db
			.update(schema.platformUsers)
			.set(updateSet)
			.where(eq(schema.platformUsers.id, userId));

		const updated = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.id, userId))
			.limit(1);

		return c.json({
			user: {
				...updated[0],
				passwordHash: undefined,
				twoFactorSecret: undefined,
			},
		});
	} catch (error) {
		console.error('Failed to update user:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default usersWrite;
