import type { Env } from '../index';
import { assertOrgId } from '../lib/org-scope-assert';

/**
 * Process scheduled workflows that are due for execution.
 * Runs every 15 minutes via cron trigger.
 *
 * NOTE: Uses raw D1 SQL against the actual prod `workflows` table layout
 * (columns: id, tenant_id, name, type, schedule, enabled, parameters,
 * conditions, last_executed_at, next_execution_at). The Drizzle queries in
 * `@tenantiq/db` target a different Postgres shape (workflow_type,
 * trigger_type, etc.) and fail against D1 — do NOT reintroduce them here
 * without first reconciling the two schemas.
 */
export async function runWorkflowTriggerCheck(env: Env): Promise<void> {
	console.log('[WorkflowTrigger] Checking workflow triggers');
	const db = env.DB;

	const tenantsRes = await db
		.prepare("SELECT id, display_name, organization_id FROM tenants WHERE status = 'active'")
		.all<{ id: string; display_name: string; organization_id: string | null }>();

	for (const tenant of tenantsRes.results ?? []) {
		assertOrgId(tenant.organization_id, 'WorkflowTrigger');
		try {
			const workflowsRes = await db
				.prepare(
					`SELECT id, name, type, schedule, last_executed_at
					 FROM workflows
					 WHERE tenant_id = ? AND enabled = 1 AND schedule IS NOT NULL AND schedule != ''`,
				)
				.bind(tenant.id)
				.all<{
					id: string;
					name: string;
					type: string;
					schedule: string | null;
					last_executed_at: string | null;
				}>();

			const now = Date.now();
			for (const wf of workflowsRes.results ?? []) {
				if (!wf.schedule) continue;
				const lastRun = wf.last_executed_at ? new Date(wf.last_executed_at).getTime() : 0;
				const intervalMs = getIntervalMs(wf.schedule);
				if (now - lastRun < intervalMs) continue;

				await env.SCAN_QUEUE.send({
					type: 'workflow_execution',
					workflowId: wf.id,
					tenantId: tenant.id,
				});

				await db
					.prepare('UPDATE workflows SET last_executed_at = ? WHERE id = ?')
					.bind(new Date().toISOString(), wf.id)
					.run();

				console.log(`[WorkflowTrigger] Triggered: ${wf.name}`);
			}
		} catch (err) {
			console.error(`[WorkflowTrigger] Failed for ${tenant.display_name}:`, err);
		}
	}

	console.log('[WorkflowTrigger] Check complete');
}

function getIntervalMs(schedule: string): number {
	const intervals: Record<string, number> = {
		'15m': 15 * 60 * 1000,
		'1h': 60 * 60 * 1000,
		'6h': 6 * 60 * 60 * 1000,
		daily: 24 * 60 * 60 * 1000,
		weekly: 7 * 24 * 60 * 60 * 1000,
		quarterly: 90 * 24 * 60 * 60 * 1000,
	};
	return intervals[schedule] ?? 24 * 60 * 60 * 1000;
}
