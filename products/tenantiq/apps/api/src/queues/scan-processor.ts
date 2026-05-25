import type { Env } from '../index';
import type { ScanMessage } from './scan-types';
import { processAlertCandidates } from './alert-handler';
import { processFullSync } from './sync-handler';
import { processWorkflowExecution } from './workflow-handler';

// Re-export public API so existing imports continue to work
export type { ScanMessage } from './scan-types';
export { getSeverityFromRule, getCategoryFromRule, getRemediationType } from './scan-types';
export { processAlertCandidates } from './alert-handler';
export { processFullSync } from './sync-handler';
export { processWorkflowExecution } from './workflow-handler';

export async function processScanResult(message: unknown, env: Env) {
	const msg = message as ScanMessage;

	if (msg.type === 'alert_candidates' && msg.candidates) {
		await processAlertCandidates(msg, env);
	}

	if (msg.type === 'full_sync') {
		await processFullSync(msg.tenantId, env);
	}

	if (msg.type === 'workflow_execution') {
		await processWorkflowExecution(
			msg as unknown as { workflowId: string; runId: string; tenantId: string },
			env
		);
	}
}
