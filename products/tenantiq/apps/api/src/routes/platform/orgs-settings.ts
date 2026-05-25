import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { getDb, schema } from '../../lib/db';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../../index';
import { updateOrganizationSchema } from './orgs-crud';

const orgsSettings = new Hono<AppEnv>();

/**
 * PATCH /:orgId — Update an organization (platform admins, or org members editing their own)
 */
orgsSettings.patch('/:orgId', validateBody(updateOrganizationSchema), async (c) => {
	const db = getDb(c.env);
	const orgId = c.req.param('orgId');
	if (!orgId) return c.json({ error: 'Missing orgId' }, 400);
	const currentUser = c.get('user') as { role?: string; orgId?: string };
	if (currentUser?.role !== 'platform_admin' && currentUser?.orgId !== orgId) {
		return c.json({ error: 'Forbidden', message: 'Access denied' }, 403);
	}
	// Whitelist from Zod — never spread raw JSON (blocks tier/status/trial tampering).
	const updates = c.get('validatedBody') as Record<string, unknown>;

	try {
		const existing = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, orgId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
		}

		const now = new Date().toISOString();
		await db
			.update(schema.organizations)
			.set({
				...updates,
				updatedAt: now,
			})
			.where(eq(schema.organizations.id, orgId));

		const updated = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, orgId))
			.limit(1);

		return c.json({ organization: updated[0] });
	} catch (error) {
		console.error('Failed to update organization:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * DELETE /:orgId — Soft delete an organization (platform admins only)
 */
orgsSettings.delete('/:orgId', requireRole('platform_admin', 'super_admin'), async (c) => {
	const db = getDb(c.env);
	const orgId = c.req.param('orgId');
	if (!orgId) return c.json({ error: 'Missing orgId' }, 400);

	try {
		const existing = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, orgId))
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'Organization not found' }, 404);
		}

		const now = new Date().toISOString();
		await db
			.update(schema.organizations)
			.set({
				status: 'deleted',
				deletedAt: now,
				updatedAt: now,
			})
			.where(eq(schema.organizations.id, orgId));

		return c.json({ message: 'Organization deleted successfully' });
	} catch (error) {
		console.error('Failed to delete organization:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * GET /:orgId/stats — Get comprehensive statistics for an organization
 */
orgsSettings.get('/:orgId/stats', async (c) => {
	const db = getDb(c.env);
	const orgId = c.req.param('orgId');
	if (!orgId) return c.json({ error: 'Missing orgId' }, 400);

	try {
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

		const alerts = await db
			.select({
				severity: schema.alerts.severity,
				count: schema.alerts.id,
			})
			.from(schema.alerts)
			.where(
				and(
					eq(schema.alerts.tenantId, orgId),
					eq(schema.alerts.status, 'active')
				)
			);

		const users = await db
			.select({
				status: schema.platformUsers.status,
				count: schema.platformUsers.id,
			})
			.from(schema.platformUsers)
			.where(eq(schema.platformUsers.organizationId, orgId));

		return c.json({
			usage: usage[0] || null,
			alerts: {
				byStatus: alerts,
				total: alerts.reduce((sum, a) => sum + 1, 0),
			},
			users: {
				byStatus: users,
				total: users.reduce((sum, u) => sum + 1, 0),
			},
		});
	} catch (error) {
		console.error('Failed to fetch organization stats:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

export default orgsSettings;
