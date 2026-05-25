import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { validateBody } from '../../middleware/validation.middleware';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { createOrganizationSchema } from './orgs-crud';

const orgsCreate = new Hono<AppEnv>();

/**
 * POST / — Create a new customer organization
 */
orgsCreate.post('/', validateBody(createOrganizationSchema), async (c) => {
	const db = getDb(c.env);
	const user = c.get('user');
	const data = await c.req.json();

	try {
		const existing = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.slug, data.slug))
			.limit(1);

		if (existing.length > 0) {
			return c.json({
				error: 'Conflict',
				message: 'An organization with this slug already exists',
			}, 409);
		}

		const now = new Date().toISOString();
		const orgId = nanoid();

		const tierLimits = {
			core: { maxUsers: 50, maxScansPerMonth: 100, maxAlerts: 1000, maxStorageGB: 10 },
			professional: { maxUsers: 200, maxScansPerMonth: 500, maxAlerts: 5000, maxStorageGB: 50 },
			security_suite: { maxUsers: 500, maxScansPerMonth: 2000, maxAlerts: 20000, maxStorageGB: 200 },
			enterprise: { maxUsers: 9999, maxScansPerMonth: 99999, maxAlerts: 999999, maxStorageGB: 5000 },
		};

		const limits = tierLimits[data.subscriptionTier as keyof typeof tierLimits];

		const trialEndsAt = new Date();
		trialEndsAt.setDate(trialEndsAt.getDate() + (data.trialDays || 14));

		const org = {
			id: orgId,
			name: data.name,
			slug: data.slug,
			domain: data.domain,
			primaryContactEmail: data.primaryContactEmail,
			primaryContactName: data.primaryContactName,
			phone: data.phone,
			addressLine1: data.addressLine1,
			addressLine2: data.addressLine2,
			city: data.city,
			state: data.state,
			zipCode: data.zipCode,
			country: data.country,
			subscriptionTier: data.subscriptionTier,
			subscriptionStatus: data.subscriptionStatus,
			billingEmail: data.billingEmail || data.primaryContactEmail,
			industry: data.industry,
			companySize: data.companySize,
			websiteUrl: data.websiteUrl,
			maxUsers: limits.maxUsers,
			maxScansPerMonth: limits.maxScansPerMonth,
			maxAlerts: limits.maxAlerts,
			maxStorageGB: limits.maxStorageGB,
			status: 'active',
			createdAt: now,
			createdBy: user.sub,
			updatedAt: now,
			trialStartedAt: data.subscriptionStatus === 'trial' ? now : null,
			trialEndsAt: data.subscriptionStatus === 'trial' ? trialEndsAt.toISOString() : null,
		};

		await db.insert(schema.organizations).values(org);

		return c.json({ organization: org }, 201);
	} catch (error) {
		console.error('Failed to create organization:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default orgsCreate;
