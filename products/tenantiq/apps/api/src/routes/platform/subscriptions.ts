import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { standardRateLimit } from '../../middleware/rateLimit.middleware';
import { getDb, schema } from '../../lib/db';
import { eq, and, lte } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { createSubscriptionSchema, updateSubscriptionSchema } from './subscription-tiers';
import {
	listSubscriptions,
	createSubscription,
	updateSubscription,
} from './subscription-handlers';
import { getUsage, recordUsage } from './subscription-usage-handlers';

/**
 * Subscription & Billing Management Routes
 *
 * Manage subscriptions, invoices, and usage tracking for organizations
 */

const subscriptions = new Hono<AppEnv>();

subscriptions.use('*', authMiddleware);
subscriptions.use('*', requireRole('platform_admin', 'super_admin', 'admin'));
subscriptions.use('*', standardRateLimit);

// Subscription CRUD
subscriptions.get('/', listSubscriptions);
subscriptions.post('/', validateBody(createSubscriptionSchema), createSubscription);
subscriptions.patch('/:subscriptionId', validateBody(updateSubscriptionSchema), updateSubscription);

// Usage tracking
subscriptions.get('/usage', getUsage);
subscriptions.post('/usage', recordUsage);

// Invoices
subscriptions.get('/invoices', async (c) => {
	const db = getDb(c.env);
	const organizationId = c.req.query('organizationId');
	const status = c.req.query('status');

	try {
		const conditions: import('drizzle-orm').SQL<unknown>[] = [];
		if (organizationId) {
			conditions.push(eq(schema.invoices.organizationId, organizationId));
		}
		if (status) {
			conditions.push(eq(schema.invoices.status, status));
		}

		const invoices = await db
			.select()
			.from(schema.invoices)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(schema.invoices.issueDate);

		return c.json({ invoices });
	} catch (error) {
		console.error('Failed to list invoices:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

// Expiring subscriptions
subscriptions.get('/expiring', async (c) => {
	const db = getDb(c.env);
	const days = parseInt(c.req.query('days') || '30');
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + days);

	try {
		const expiring = await db
			.select()
			.from(schema.subscriptions)
			.where(
				and(
					lte(schema.subscriptions.currentPeriodEnd, futureDate.toISOString()),
					eq(schema.subscriptions.status, 'active')
				)
			)
			.orderBy(schema.subscriptions.currentPeriodEnd);

		return c.json({ subscriptions: expiring, count: expiring.length });
	} catch (error) {
		console.error('Failed to fetch expiring subscriptions:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default subscriptions;
