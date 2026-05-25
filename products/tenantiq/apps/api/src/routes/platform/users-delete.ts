import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { getDb, schema } from '../../lib/db';

const usersDelete = new Hono<AppEnv>();

/** DELETE /:userId — Soft-delete a user (platform admin, or same-org admin) */
usersDelete.delete('/:userId', async (c) => {
	const db = getDb(c.env);
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const currentUser = c.get('user');

	try {
		const existing = await db
			.select()
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.id, userId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'User not found' }, 404);
		}

		if (currentUser.role !== 'platform_admin') {
			if (existing[0].organizationId !== currentUser.orgId) {
				return c.json({ error: 'Forbidden', message: 'Access denied' }, 403);
			}
		}

		const now = new Date().toISOString();
		await db
			.update(schema.platformUsers)
			.set({
				status: 'deleted',
				deletedAt: now,
				updatedAt: now,
			})
			.where(eq(schema.platformUsers.id, userId));

		return c.json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Failed to delete user:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default usersDelete;
