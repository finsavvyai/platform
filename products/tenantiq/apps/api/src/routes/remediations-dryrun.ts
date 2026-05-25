import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { strictRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and } from 'drizzle-orm';
import { getDryRunResult } from '@tenantiq/remediation';
import type { AppEnv } from '../app/types';

/**
 * Remediation Dry-Run Route
 *
 * Preview what a remediation action WOULD change without executing it.
 */

const dryRunSchema = z
	.object({
		alertId: z.string().min(1).optional(),
		actionType: z.string().min(1).optional(),
		targetId: z.string().min(1).optional(),
	})
	.refine((data) => data.alertId || (data.actionType && data.targetId), {
		message: 'Provide either alertId or both actionType and targetId',
	});

const remediationsDryRun = new Hono<AppEnv>();

remediationsDryRun.use('*', authMiddleware);
remediationsDryRun.use('*', strictRateLimit);

/**
 * POST /remediations/dry-run
 * Preview remediation changes without executing
 */
remediationsDryRun.post(
	'/dry-run',
	requireRole('operator', 'admin', 'super_admin'),
	async (c) => {
		const body = await c.req.json();
		const parsed = dryRunSchema.safeParse(body);

		if (!parsed.success) {
			return c.json(
				{ error: 'Bad Request', message: parsed.error.issues[0].message },
				400
			);
		}

		const { alertId, actionType, targetId } = parsed.data;
		let resolvedActionType = actionType;
		let params: Record<string, unknown> = { targetId };

		// If alertId provided, resolve action type from the alert
		if (alertId) {
			const tenantId = c.get('tenantId');
			const db = getDb(c.env);

			const alert = await db
				.select()
				.from(schema.alerts)
				.where(
					and(
						eq(schema.alerts.id, alertId),
						eq(schema.alerts.tenantId, tenantId)
					)
				)
				.limit(1);

			if (alert.length === 0) {
				return c.json({ error: 'Not Found', message: 'Alert not found' }, 404);
			}

			resolvedActionType = alert[0].autoRemediationAction ?? undefined;
			params = {
				targetId: alert[0].resourceId ?? undefined,
			};

			if (!resolvedActionType) {
				return c.json(
					{ error: 'Bad Request', message: 'Alert has no associated remediation action' },
					400
				);
			}
		}

		const result = await getDryRunResult(resolvedActionType!, params);

		return c.json({ data: result });
	}
);

export default remediationsDryRun;
