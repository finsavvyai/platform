import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { strictRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../app/types';
import { createRollbackPlan, isRollbackSupported, getIrreversibleReason } from '@tenantiq/remediation';

/**
 * Remediation Rollback Routes
 *
 * Handles rollback of completed remediation actions.
 * Uses createRollbackPlan() to validate and queue rollback operations.
 */

const rollbackRoutes = new Hono<AppEnv>();
rollbackRoutes.use('*', authMiddleware);
rollbackRoutes.use('*', strictRateLimit);

/**
 * POST /remediations/:remediationId/rollback
 * Validates rollback feasibility, creates a rollback plan, and queues execution.
 */
rollbackRoutes.post(
	'/:remediationId/rollback',
	requireRole('admin', 'super_admin'),
	async (c) => {
		const tenantId = c.get('tenantId');
		const userId = c.get('userId');
		const remediationId = c.req.param('remediationId');
		if (!remediationId) return c.json({ error: 'Missing remediationId' }, 400);
		const db = getDb(c.env);

		const remediation = await db
			.select()
			.from(schema.remediations)
			.where(
				and(
					eq(schema.remediations.id, remediationId),
					eq(schema.remediations.tenantId, tenantId)
				)
			)
			.limit(1);

		if (remediation.length === 0) {
			return c.json({ error: 'Not Found', message: 'Remediation not found' }, 404);
		}

		const record = remediation[0];

		if (!record.canRollback) {
			return c.json(
				{ error: 'Bad Request', message: 'This remediation cannot be rolled back' },
				400
			);
		}

		if (record.status !== 'completed') {
			return c.json(
				{ error: 'Bad Request', message: 'Only completed remediations can be rolled back' },
				400
			);
		}

		// Check if the action type supports rollback at all
		if (!isRollbackSupported(record.actionType)) {
			const reason = getIrreversibleReason(record.actionType);
			return c.json(
				{ error: 'Bad Request', message: reason ?? 'This action type cannot be rolled back' },
				400
			);
		}

		// Parse stored state snapshots from rollbackData or action results
		const rollbackData = parseJsonSafe(record.rollbackData);
		const beforeState = (rollbackData?.beforeState ?? {}) as Record<string, unknown>;
		const afterState = (rollbackData?.afterState ?? {}) as Record<string, unknown>;

		// Validate rollback plan creation (will throw if unsupported)
		try {
			createRollbackPlan(record.actionType, beforeState, afterState, tenantId);
		} catch (err) {
			console.error('Failed to create rollback plan:', err);
			return c.json({ error: 'Failed to create rollback plan' }, 400);
		}

		// Generate rollback tracking ID
		const rollbackId = crypto.randomUUID();

		// Queue rollback for async execution with full state
		await c.env.REMEDIATION_QUEUE.send({
			type: 'rollback',
			tenantId,
			remediationId,
			rollbackId,
			actionType: record.actionType,
			beforeState,
			afterState,
			executedBy: userId || 'system',
		});

		// Mark original remediation as rollback_pending
		await db
			.update(schema.remediations)
			.set({
				status: 'rollback_pending',
				rolledBackBy: userId || 'system'
			})
			.where(eq(schema.remediations.id, remediationId));

		return c.json({
			success: true,
			rollbackId,
			remediationId,
			status: 'rollback_pending',
			message: 'Rollback queued for execution',
		});
	}
);

function parseJsonSafe(value: string | null | undefined): Record<string, unknown> | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export { rollbackRoutes };
