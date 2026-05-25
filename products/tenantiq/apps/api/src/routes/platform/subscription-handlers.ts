import { nanoid } from 'nanoid';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc, type SQL } from 'drizzle-orm';
import type { Context } from 'hono';
import type { AppEnv } from '../../index';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from './subscription-tiers';

/** GET /platform/subscriptions — List all subscriptions */
export async function listSubscriptions(c: Context<AppEnv>) {
	const db = getDb(c.env);
	const organizationId = c.req.query('organizationId');
	const status = c.req.query('status');

	try {
		const conditions: SQL<unknown>[] = [];
		if (organizationId) {
			conditions.push(eq(schema.subscriptions.organizationId, organizationId));
		}
		if (status) {
			conditions.push(eq(schema.subscriptions.status, status));
		}

		const subs = await db
			.select()
			.from(schema.subscriptions)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(schema.subscriptions.createdAt));

		return c.json({ subscriptions: subs });
	} catch (error) {
		console.error('Failed to list subscriptions:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
}

/** POST /platform/subscriptions — Create a new subscription */
export async function createSubscription(c: Context<AppEnv>) {
	const db = getDb(c.env);
	// Whitelisted by createSubscriptionSchema — never spread raw JSON.
	const data = c.get('validatedBody') as {
		organizationId: string;
		tier: SubscriptionTier;
		billingInterval: 'monthly' | 'annual';
		customPrice?: number;
		startDate?: string;
	};

	try {
		const org = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, data.organizationId))
			.limit(1);

		if (org.length === 0) {
			return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
		}

		const tierConfig = SUBSCRIPTION_TIERS[data.tier as SubscriptionTier];
		const price = data.customPrice || (data.billingInterval === 'annual' ? tierConfig.annualPrice : tierConfig.monthlyPrice);

		const now = new Date();
		const startDate = data.startDate ? new Date(data.startDate) : now;
		const periodEnd = new Date(startDate);

		if (data.billingInterval === 'monthly') {
			periodEnd.setMonth(periodEnd.getMonth() + 1);
		} else {
			periodEnd.setFullYear(periodEnd.getFullYear() + 1);
		}

		const subscription = {
			id: nanoid(),
			organizationId: data.organizationId,
			tier: data.tier,
			status: 'active',
			monthlyPrice: price,
			currency: 'USD',
			billingInterval: data.billingInterval,
			currentPeriodStart: startDate.toISOString(),
			currentPeriodEnd: periodEnd.toISOString(),
			maxUsers: tierConfig.maxUsers,
			maxScansPerMonth: tierConfig.maxScansPerMonth,
			maxAlerts: tierConfig.maxAlerts,
			maxStorageGB: tierConfig.maxStorageGB,
			features: JSON.stringify(tierConfig.features),
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		};

		await db.insert(schema.subscriptions).values(subscription);

		await db
			.update(schema.organizations)
			.set({
				subscriptionTier: data.tier,
				subscriptionStatus: 'active',
				maxUsers: tierConfig.maxUsers,
				maxScansPerMonth: tierConfig.maxScansPerMonth,
				maxAlerts: tierConfig.maxAlerts,
				maxStorageGB: tierConfig.maxStorageGB,
				updatedAt: now.toISOString(),
			})
			.where(eq(schema.organizations.id, data.organizationId));

		return c.json({ subscription }, 201);
	} catch (error) {
		console.error('Failed to create subscription:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
}

/** PATCH /platform/subscriptions/:subscriptionId — Update a subscription */
export async function updateSubscription(c: Context<AppEnv>) {
	const db = getDb(c.env);
	const subscriptionId = c.req.param('subscriptionId');
	if (!subscriptionId) return c.json({ error: 'Missing subscriptionId' }, 400);
	// Whitelisted by updateSubscriptionSchema — never spread raw JSON.
	const updates = c.get('validatedBody') as {
		tier?: SubscriptionTier;
		status?: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
		billingInterval?: 'monthly' | 'annual';
		cancelAtPeriodEnd?: boolean;
	};

	try {
		const existing = await db
			.select()
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.id, subscriptionId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'Subscription not found' }, 404);
		}

		const now = new Date().toISOString();

		const updateSet: Record<string, unknown> = { updatedAt: now };
		if (updates.tier) {
			const tierConfig = SUBSCRIPTION_TIERS[updates.tier];
			updateSet.tier = updates.tier;
			updateSet.maxUsers = tierConfig.maxUsers;
			updateSet.maxScansPerMonth = tierConfig.maxScansPerMonth;
			updateSet.maxAlerts = tierConfig.maxAlerts;
			updateSet.maxStorageGB = tierConfig.maxStorageGB;
			updateSet.features = JSON.stringify(tierConfig.features);
		}
		if (updates.status !== undefined) updateSet.status = updates.status;
		if (updates.billingInterval !== undefined) updateSet.billingInterval = updates.billingInterval;
		if (updates.cancelAtPeriodEnd !== undefined) updateSet.cancelAtPeriodEnd = updates.cancelAtPeriodEnd;

		await db
			.update(schema.subscriptions)
			.set(updateSet)
			.where(eq(schema.subscriptions.id, subscriptionId));

		const updated = await db
			.select()
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.id, subscriptionId))
			.limit(1);

		if (updates.status) {
			await db
				.update(schema.organizations)
				.set({ subscriptionStatus: updates.status, updatedAt: now })
				.where(eq(schema.organizations.id, existing[0].organizationId));
		}

		return c.json({ subscription: updated[0] });
	} catch (error) {
		console.error('Failed to update subscription:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
}
