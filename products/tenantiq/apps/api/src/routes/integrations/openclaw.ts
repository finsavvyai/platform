/**
 * OpenClaw Integration API Routes
 * Manages OpenClaw skill installation, platform connections, and webhook configurations
 */

import { Hono } from 'hono';
import { getDb } from '../../lib/db';
import { webhookConfigs } from '../../../drizzle/schema/webhooks.schema';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { authMiddleware } from '../../middleware/auth';

const app = new Hono<AppEnv>();

// Apply auth middleware
app.use('*', authMiddleware);

/**
 * Get OpenClaw integration status
 */
app.get('/status', async (c) => {
	try {
		const user = c.get('user');

		// Check if skill is installed by checking for webhook config
			const db = getDb(c.env);
			const configs = await db
				.select()
				.from(webhookConfigs)
				.limit(1);

		return c.json({
			installed: configs.length > 0,
			connectedPlatforms: [], // TODO: Get from OpenClaw API
			lastSync: null
		});
	} catch (error) {
		console.error('Failed to get OpenClaw status:', error);
		return c.json({ error: 'Failed to get status' }, 500);
	}
});

/**
 * Get connected platforms
 */
app.get('/platforms', async (c) => {
	try {
		// TODO: Query OpenClaw API for connected platforms
		// For now, return empty array
		return c.json([]);
	} catch (error) {
		console.error('Failed to get platforms:', error);
		return c.json({ error: 'Failed to get platforms' }, 500);
	}
});

/**
 * Connect a platform
 */
app.post('/platforms/:platformId/connect', async (c) => {
	try {
		const platformId = c.req.param('platformId');

		// TODO: Integrate with OpenClaw API to connect platform
		console.log(`Connecting platform: ${platformId}`);

		return c.json({
			success: true,
			message: `Platform ${platformId} connection initiated`
		});
	} catch (error) {
		console.error('Failed to connect platform:', error);
		return c.json({ error: 'Failed to connect platform' }, 500);
	}
});

/**
 * Disconnect a platform
 */
app.post('/platforms/:platformId/disconnect', async (c) => {
	try {
		const platformId = c.req.param('platformId');

		// TODO: Integrate with OpenClaw API to disconnect platform
		console.log(`Disconnecting platform: ${platformId}`);

		return c.json({
			success: true,
			message: `Platform ${platformId} disconnected`
		});
	} catch (error) {
		console.error('Failed to disconnect platform:', error);
		return c.json({ error: 'Failed to disconnect platform' }, 500);
	}
});

export default app;
