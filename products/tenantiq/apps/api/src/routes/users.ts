import { Hono } from 'hono';
import { createGraphClient } from '../lib/graph-client';
import { authMiddleware, requireRole, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import type { AppEnv } from '../app/types';

/**
 * User & License Management Routes
 *
 * Endpoints for managing users and licenses via Microsoft Graph API.
 */

const users = new Hono<AppEnv>();

users.use('*', authMiddleware);
users.use('*', standardRateLimit);

/**
 * GET /users
 * Get all users for a tenant from Microsoft Graph
 */
users.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		const graphUsers = await graphClient.getUsers();

		return c.json({
			users: graphUsers,
			count: graphUsers.length,
		});
	} catch (error) {
		console.error('Failed to fetch users:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

/**
 * GET /users/:userId
 * Get detailed information about a specific user
 */
users.get('/:userId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		const user = await graphClient.getUser(userId);

		return c.json({ user });
	} catch (error) {
		console.error('Failed to fetch user:', error);
		return c.json(
			{
				error: 'Not Found',
				message: 'User not found or access denied',
			},
			404
		);
	}
});

/**
 * GET /users/:userId/licenses
 * Get license assignments for a specific user
 */
users.get('/:userId/licenses', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		const user = await graphClient.getUser(userId);

		return c.json({
			userId,
			licenses: user.assignedLicenses || [],
		});
	} catch (error) {
		console.error('Failed to fetch user licenses:', error);
		return c.json(
			{
				error: 'Not Found',
				message: 'User not found or access denied',
			},
			404
		);
	}
});

/**
 * POST /users/:userId/licenses
 * Assign a license to a user
 */
users.post('/:userId/licenses', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const { skuId } = await c.req.json();

	if (!skuId) {
		return c.json({ error: 'Bad Request', message: 'skuId is required' }, 400);
	}

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		await graphClient.assignLicense(userId, skuId);

		return c.json({
			message: 'License assigned successfully',
			userId,
			skuId,
		});
	} catch (error) {
		console.error('Failed to assign license:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

/**
 * DELETE /users/:userId/licenses/:skuId
 * Remove a license from a user
 */
users.delete('/:userId/licenses/:skuId', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const skuId = c.req.param('skuId');
	if (!skuId) return c.json({ error: 'Missing skuId' }, 400);

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		await graphClient.removeLicense(userId, skuId);

		return c.json({
			message: 'License removed successfully',
			userId,
			skuId,
		});
	} catch (error) {
		console.error('Failed to remove license:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

/**
 * GET /licenses
 * Get available licenses for the tenant
 */
users.get('/licenses/available', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const graphClient = createGraphClient(c.env, tenantId);
		const skus = await graphClient.getSubscribedSkus();

		return c.json({
			licenses: skus,
			count: skus.length,
		});
	} catch (error) {
		console.error('Failed to fetch licenses:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
});

export { users as userRoutes };
export default users;
