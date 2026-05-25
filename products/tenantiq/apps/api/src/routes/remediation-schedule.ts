import { Hono } from 'hono';
import { z } from 'zod';
import { tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../app/types';

/**
 * Remediation Schedule Routes
 *
 * List, cancel, and reschedule deferred remediations.
 */

const scheduleBody = z.object({
	scheduledAt: z.string().datetime().optional(),
	cancel: z.boolean().optional(),
});

export const remediationScheduleRoutes = new Hono<AppEnv>();

/** GET /scheduled — list all scheduled remediations for the current tenant */
remediationScheduleRoutes.get('/scheduled', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	const scheduled = await db
		.select({
			id: schema.remediations.id,
			alertId: schema.remediations.alertId,
			actionType: schema.remediations.actionType,
			scheduledAt: schema.remediations.scheduledAt,
			createdBy: schema.remediations.initiatedBy,
		})
		.from(schema.remediations)
		.where(
			and(
				eq(schema.remediations.tenantId, tenantId),
				eq(schema.remediations.status, 'scheduled')
			)
		);

	return c.json({ scheduled });
});

/** PATCH /:id/schedule — update scheduledAt or cancel a scheduled remediation */
remediationScheduleRoutes.patch(
	'/:id/schedule',
	requireRole('operator', 'admin', 'super_admin'),
	async (c) => {
		const tenantId = c.get('tenantId');
		const remediationId = c.req.param('id');
		if (!remediationId) return c.json({ error: 'Missing id' }, 400);
		const db = getDb(c.env);

		const body = scheduleBody.safeParse(await c.req.json());
		if (!body.success) {
			return c.json({ error: 'Invalid request body' }, 400);
		}

		const { scheduledAt, cancel } = body.data;

		// Verify remediation exists, is tenant-scoped, and is in scheduled status
		const existing = await db
			.select()
			.from(schema.remediations)
			.where(
				and(
					eq(schema.remediations.id, remediationId),
					eq(schema.remediations.tenantId, tenantId)
				)
			)
			.limit(1);

		if (existing.length === 0) {
			return c.json({ error: 'Not Found', message: 'Remediation not found' }, 404);
		}

		if (existing[0].status !== 'scheduled') {
			return c.json(
				{ error: 'Bad Request', message: 'Only scheduled remediations can be modified' },
				400
			);
		}

		if (cancel) {
			await db
				.update(schema.remediations)
				.set({ status: 'cancelled' })
				.where(eq(schema.remediations.id, remediationId));

			return c.json({ message: 'Remediation cancelled', remediationId, status: 'cancelled' });
		}

		if (scheduledAt) {
			const newTime = new Date(scheduledAt);
			if (newTime <= new Date()) {
				return c.json(
					{ error: 'Bad Request', message: 'scheduledAt must be in the future' },
					400
				);
			}
			await db
				.update(schema.remediations)
				.set({ scheduledAt: newTime.toISOString() })
				.where(eq(schema.remediations.id, remediationId));

			return c.json({
				message: 'Remediation rescheduled',
				remediationId,
				scheduledAt: newTime.toISOString(),
			});
		}

		return c.json({ error: 'Bad Request', message: 'Provide scheduledAt or cancel' }, 400);
	}
);
