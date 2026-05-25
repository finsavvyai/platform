/**
 * Tenant Webhook Configuration Routes
 * Manage webhook configurations for individual tenants
 */

import { Hono } from 'hono';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { ZodError } from 'zod';
import {
	parseCategories,
	sendSignedTestWebhook,
	serializeCategories,
	webhookConfigSchema,
} from './webhooks-utils';

const app = new Hono<AppEnv>();

// Apply middleware
app.use('*', authMiddleware);
app.use('*', tenantMiddleware);

/**
 * Get webhook configuration for tenant
 */
app.get('/config', async (c) => {
	try {
		const tenantId = c.get('tenantId');
		const db = getDb(c.env);

		const configs = await db
			.select()
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId))
			.limit(1);

		if (configs.length === 0) {
			return c.json(null);
		}

		const config = configs[0];
		return c.json({
			...config,
			enabled: Boolean(config.enabled),
			categories: parseCategories(config.categories),
		});
	} catch (error) {
		console.error('Failed to get webhook config:', error);
		return c.json({ error: 'Failed to get webhook configuration' }, 500);
	}
});

/**
 * Create or update webhook configuration
 */
app.post('/config', async (c) => {
	try {
		const tenantId = c.get('tenantId');
		const body = await c.req.json();

		// Validate input
		const validatedData = webhookConfigSchema.parse(body);

		const db = getDb(c.env);

		// Check if config exists
		const existing = await db
			.select()
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId))
			.limit(1);

		if (existing.length > 0) {
			// Update existing
			await db
				.update(schema.webhookConfigs)
				.set({
					...validatedData,
					enabled: validatedData.enabled ? 1 : 0,
					categories: serializeCategories(validatedData.categories),
					updatedAt: new Date().toISOString()
				})
				.where(eq(schema.webhookConfigs.id, existing[0].id));

			return c.json({
				success: true,
				message: 'Webhook configuration updated'
			});
		} else {
			// Create new
			await db.insert(schema.webhookConfigs).values({
				id: crypto.randomUUID(),
				tenantId,
				...validatedData,
				enabled: validatedData.enabled ? 1 : 0,
				categories: serializeCategories(validatedData.categories),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			return c.json({
				success: true,
				message: 'Webhook configuration created'
			}, 201);
		}
	} catch (error) {
		if (error instanceof ZodError) {
			return c.json({
				error: 'Invalid webhook configuration',
				details: error.errors
			}, 400);
		}

		console.error('Failed to save webhook config:', error);
		return c.json({ error: 'Failed to save webhook configuration' }, 500);
	}
});

/**
 * Delete webhook configuration
 */
app.delete('/config', async (c) => {
	try {
		const tenantId = c.get('tenantId');
		const db = getDb(c.env);

		await db
			.delete(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId));

		return c.json({
			success: true,
			message: 'Webhook configuration deleted'
		});
	} catch (error) {
		console.error('Failed to delete webhook config:', error);
		return c.json({ error: 'Failed to delete webhook configuration' }, 500);
	}
});

/**
 * Test webhook delivery
 */
app.post('/test', async (c) => {
	try {
		const tenantId = c.get('tenantId');
		const db = getDb(c.env);

		// Get webhook config
		const configs = await db
			.select()
			.from(schema.webhookConfigs)
			.where(eq(schema.webhookConfigs.tenantId, tenantId))
			.limit(1);

		if (configs.length === 0) {
			return c.json({
				error: 'No webhook configuration found'
			}, 404);
		}

		const config = configs[0];
		const result = await sendSignedTestWebhook(config, tenantId);
		if (result.ok) {
			return c.json({
				success: true,
				message: 'Test webhook delivered successfully',
				status: result.status
			});
		}

		return c.json({
			success: false,
			message: 'Test webhook delivery failed',
			status: result.status,
			error: result.error
		}, 400);
	} catch (error) {
		console.error('Failed to test webhook:', error);
		return c.json({
			error: 'Failed to test webhook',
		}, 500);
	}
});

export default app;
