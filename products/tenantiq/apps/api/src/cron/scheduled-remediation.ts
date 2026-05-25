import { and, eq, lte } from 'drizzle-orm';
import type { Env } from '../app/types';
import { getDb, schema } from '../lib/db';
import { assertOrgId } from '../lib/org-scope-assert';

const BATCH_LIMIT = 100;

/**
 * Process scheduled remediations that are due for execution.
 * Runs every 5 minutes via cron trigger.
 */
export async function runScheduledRemediations(env: Env): Promise<void> {
	const db = getDb(env);
	const nowIso = new Date().toISOString();

	console.log('[ScheduledRemediation] Checking for due remediations');

	const dueRemediations = await db
		.select()
		.from(schema.remediations)
		.where(
			and(
				eq(schema.remediations.status, 'scheduled'),
				lte(schema.remediations.scheduledAt, nowIso)
			)
		)
		.limit(BATCH_LIMIT);

	// INFO: This is an intentional platform-wide query across all orgs —
	// dueRemediations are scoped by tenantId (not organizationId) at the remediation record level.
	// assertOrgId is called per record to prevent any record without tenant context from being queued.
	for (const rem of dueRemediations) {
		assertOrgId(rem.tenantId, 'ScheduledRemediation');
		try {
			await env.REMEDIATION_QUEUE.send({
				tenantId: rem.tenantId,
				alertId: rem.alertId,
				remediationId: rem.id,
				actionId: rem.actionType,
				affectedResources: [],
				executedBy: rem.initiatedBy,
			});

			await db
				.update(schema.remediations)
				.set({ status: 'pending' })
				.where(eq(schema.remediations.id, rem.id));
		} catch (error) {
			console.error(`[ScheduledRemediation] Failed to queue ${rem.id}:`, error);
		}
	}

	console.log(`[ScheduledRemediation] Processed ${dueRemediations.length} due remediations`);
}
