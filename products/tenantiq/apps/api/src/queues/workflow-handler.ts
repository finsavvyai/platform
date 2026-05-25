import type { Env } from '../index';
import { getDb } from '../lib/db';
import {
	createAuditEntry,
	getWorkflowById,
	getWorkflowRunById,
	updateWorkflowRun,
	updateWorkflow
} from '@tenantiq/db';
import { assertOrgId } from '../lib/org-scope-assert';

interface WorkflowMessage {
	workflowId: string;
	runId: string;
	tenantId: string;
}

interface WorkflowStep {
	action: string;
	condition?: string;
	onFailure: 'skip' | 'abort' | 'retry';
}

export async function processWorkflowExecution(msg: WorkflowMessage, env: Env) {
	// tenantId is the org-scope key for all workflow DB writes and audit entries in this handler
	assertOrgId(msg.tenantId, 'WorkflowHandler');

	const db = getDb(env);

	const workflow = await getWorkflowById(db, msg.workflowId);
	const run = await getWorkflowRunById(db, msg.runId);

	if (!workflow || !run) {
		console.error(`[WorkflowExec] Workflow or run not found: ${msg.workflowId}/${msg.runId}`);
		return;
	}

	const steps = (workflow.steps as WorkflowStep[]) ?? [];
	const { stepsCompleted, results } = await runSteps(steps, msg, env, db);
	const allDone = stepsCompleted === steps.length;

	if (allDone) {
		await updateWorkflowRun(db, msg.runId, {
			status: 'completed',
			result: JSON.stringify({ stepsCompleted, results }),
			completedAt: Math.floor(Date.now() / 1000),
		});
	}

	await updateWorkflow(db, msg.workflowId, {
		lastExecutedAt: Math.floor(Date.now() / 1000),
	});

	await broadcastWorkflowStatus(env, msg, stepsCompleted, steps.length);

	await env.NOTIFICATION_QUEUE.send({
		type: allDone ? 'workflow_completed' : 'workflow_failed',
		workflowId: msg.workflowId,
		workflowName: workflow.name,
		runId: msg.runId,
		tenantId: msg.tenantId
	});

	await createAuditEntry(db, {
		tenantId: msg.tenantId,
		actor: 'workflow',
		action: allDone ? 'workflow.completed' : 'workflow.partial',
		resourceType: 'workflow',
		resourceId: msg.workflowId,
		details: { runId: msg.runId, stepsCompleted, totalSteps: steps.length }
	});

	console.log(`[WorkflowExec] ${workflow.name}: ${stepsCompleted}/${steps.length} steps completed`);
}

async function runSteps(
	steps: WorkflowStep[],
	msg: WorkflowMessage,
	env: Env,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: any
): Promise<{ stepsCompleted: number; results: unknown[] }> {
	let stepsCompleted = 0;
	const results: unknown[] = [];

	for (const step of steps) {
		try {
			const result = await executeWorkflowStep(step, msg.tenantId, env);
			results.push({ step: step.action, status: 'success', result });
			stepsCompleted++;
			await updateWorkflowRun(db, msg.runId, { result: JSON.stringify({ stepsCompleted, results }) });
		} catch (err) {
			results.push({ step: step.action, status: 'failed', error: String(err) });

			if (step.onFailure === 'abort') {
				await updateWorkflowRun(db, msg.runId, {
					status: 'failed',
					result: JSON.stringify({ stepsCompleted, results }),
					completedAt: Math.floor(Date.now() / 1000),
				});
				await createAuditEntry(db, {
					tenantId: msg.tenantId,
					actor: 'workflow',
					action: 'workflow.failed',
					resourceType: 'workflow',
					resourceId: msg.workflowId,
					details: { runId: msg.runId, failedStep: step.action, error: String(err) }
				});
				break;
			}
		}
	}

	return { stepsCompleted, results };
}

async function broadcastWorkflowStatus(
	env: Env,
	msg: WorkflowMessage,
	stepsCompleted: number,
	totalSteps: number
) {
	const durableId = env.TENANT_EVENTS.idFromName(msg.tenantId);
	const stub = env.TENANT_EVENTS.get(durableId);
	await stub.fetch(new Request('https://internal/broadcast', {
		method: 'POST',
		body: JSON.stringify({
			type: 'workflow_update',
			workflowId: msg.workflowId,
			runId: msg.runId,
			status: stepsCompleted === totalSteps ? 'completed' : 'failed',
			stepsCompleted,
			totalSteps
		})
	}));
}

const ACTION_MAP: Record<string, string> = {
	decommission_inactive: 'REM-001',
	enable_mfa: 'REM-002',
	block_suspicious_ips: 'REM-003',
	downgrade_licenses: 'REM-004',
	revoke_risky_sessions: 'REM-005',
	force_password_reset: 'REM-006',
	remove_stale_guests: 'REM-007',
	restrict_sharing: 'REM-008',
	enable_conditional_access: 'REM-009'
};

async function executeWorkflowStep(
	step: { action: string; condition?: string },
	tenantId: string,
	env: Env
): Promise<unknown> {
	const actionId = ACTION_MAP[step.action];
	if (actionId) {
		await env.REMEDIATION_QUEUE.send({
			actionId,
			tenantId,
			affectedResources: [],
			executedBy: 'workflow'
		});
		return { queued: true, actionId };
	}

	if (step.action === 'send_report') {
		await env.NOTIFICATION_QUEUE.send({ type: 'workflow_report', tenantId });
		return { sent: true };
	}

	if (step.action === 'trigger_scan') {
		await env.SCAN_QUEUE.send({
			type: 'full_sync',
			tenantId,
			triggeredBy: 'workflow'
		});
		return { triggered: true };
	}

	throw new Error(`Unknown workflow action: ${step.action}`);
}
