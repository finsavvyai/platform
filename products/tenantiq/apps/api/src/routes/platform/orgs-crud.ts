import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc, like, type SQL } from 'drizzle-orm';
import type { AppEnv } from '../../index';

/**
 * Validation Schemas (exported for use by other org route modules)
 */
export const createOrganizationSchema = z.object({
	name: z.string().min(1).max(200),
	slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
	domain: z.string().optional(),
	primaryContactEmail: z.string().email(),
	primaryContactName: z.string().optional(),
	phone: z.string().optional(),
	addressLine1: z.string().optional(),
	addressLine2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zipCode: z.string().optional(),
	country: z.string().optional(),
	subscriptionTier: z.enum(['core', 'professional', 'security_suite', 'enterprise']).default('core'),
	subscriptionStatus: z.enum(['trial', 'active']).default('trial'),
	billingEmail: z.string().email().optional(),
	industry: z.string().optional(),
	companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
	websiteUrl: z.string().url().optional(),
	trialDays: z.number().min(0).max(90).default(14),
});

export const updateOrganizationSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	domain: z.string().optional(),
	primaryContactEmail: z.string().email().optional(),
	primaryContactName: z.string().optional(),
	phone: z.string().optional(),
	addressLine1: z.string().optional(),
	addressLine2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zipCode: z.string().optional(),
	country: z.string().optional(),
	subscriptionTier: z.enum(['core', 'professional', 'security_suite', 'enterprise']).optional(),
	subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'cancelled', 'suspended']).optional(),
	billingEmail: z.string().email().optional(),
	status: z.enum(['active', 'suspended', 'deleted']).optional(),
	industry: z.string().optional(),
	companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
	websiteUrl: z.string().url().optional(),
	maxUsers: z.number().min(1).optional(),
	maxScansPerMonth: z.number().min(1).optional(),
});

const orgsCrud = new Hono<AppEnv>();

/**
 * GET / — List all customer organizations with pagination and filtering
 */
orgsCrud.get('/', async (c) => {
	const db = getDb(c.env);

	const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
	const offset = parseInt(c.req.query('offset') || '0');
	const search = c.req.query('search');
	const status = c.req.query('status');
	const subscriptionStatus = c.req.query('subscriptionStatus');
	const tier = c.req.query('tier');

	try {
		const conditions: SQL<unknown>[] = [];

		if (search) {
			conditions.push(like(schema.organizations.name, `%${search}%`));
		}
		if (status) {
			conditions.push(eq(schema.organizations.status, status));
		}
		if (subscriptionStatus) {
			conditions.push(eq(schema.organizations.subscriptionStatus, subscriptionStatus));
		}
		if (tier) {
			conditions.push(eq(schema.organizations.subscriptionTier, tier));
		}

		const orgs = await db
			.select()
			.from(schema.organizations)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(schema.organizations.createdAt))
			.limit(limit)
			.offset(offset);

		const totalResult = await db
			.select({ count: schema.organizations.id })
			.from(schema.organizations)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		return c.json({
			organizations: orgs,
			total: totalResult.length,
			limit,
			offset,
		});
	} catch (error) {
		console.error('Failed to list organizations:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * GET /:orgId — Get detailed information about a specific organization
 */
orgsCrud.get('/:orgId', async (c) => {
	const db = getDb(c.env);
	const orgId = c.req.param('orgId');

	try {
		const org = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, orgId))
			.limit(1);

		if (org.length === 0) {
			return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
		}

		const subscription = await db
			.select()
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.organizationId, orgId))
			.orderBy(desc(schema.subscriptions.createdAt))
			.limit(1);

		const now = new Date();
		const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
		const usage = await db
			.select()
			.from(schema.usageMetrics)
			.where(
				and(
					eq(schema.usageMetrics.organizationId, orgId),
					eq(schema.usageMetrics.periodStart, periodStart)
				)
			)
			.limit(1);

		const users = await db
			.select({ count: schema.platformUsers.id })
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.organizationId, orgId));

		return c.json({
			organization: org[0],
			subscription: subscription[0] || null,
			usage: usage[0] || null,
			userCount: users.length,
		});
	} catch (error) {
		console.error('Failed to fetch organization:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default orgsCrud;
