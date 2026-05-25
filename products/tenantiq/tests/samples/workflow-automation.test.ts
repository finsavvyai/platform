/**
 * Sample Project 5: Workflow Automation
 *
 * Simulates: Creating, validating, and executing automated workflows
 * for security scans, user lifecycle, compliance checks, and
 * scheduled maintenance across different trigger types.
 */
import { describe, it, expect } from 'vitest';
import { workflowCreateSchema } from '@tenantiq/shared';
import type { Workflow, WorkflowStep, WorkflowRunStatus, WorkflowTriggerType } from '@tenantiq/shared';
import { makeWorkflow, healthyTenant, riskyTenant } from './fixtures/tenant-profiles';

// ── Workflow executor simulation ─────────────────────────────────

interface StepResult {
	step: number;
	action: string;
	status: 'success' | 'failed' | 'skipped';
	duration: number;
	error?: string;
}

interface WorkflowRunResult {
	workflowId: string;
	status: WorkflowRunStatus;
	stepsCompleted: number;
	stepsTotal: number;
	results: StepResult[];
	startedAt: string;
	completedAt: string;
}

function executeWorkflow(
	workflow: Workflow,
	stepOutcomes: ('success' | 'failed')[]
): WorkflowRunResult {
	const results: StepResult[] = [];
	let completed = 0;
	let aborted = false;

	for (let i = 0; i < workflow.steps.length; i++) {
		if (aborted) {
			results.push({
				step: i + 1, action: workflow.steps[i].action,
				status: 'skipped', duration: 0,
			});
			continue;
		}

		const outcome = stepOutcomes[i] ?? 'success';
		if (outcome === 'failed') {
			const failAction = workflow.steps[i].onFailure;
			results.push({
				step: i + 1, action: workflow.steps[i].action,
				status: 'failed', duration: Math.random() * 5000,
				error: `Step ${workflow.steps[i].action} failed`,
			});
			if (failAction === 'abort') aborted = true;
			else if (failAction === 'skip') { /* continue */ }
			else if (failAction === 'retry') {
				// Simulate retry success
				results.push({
					step: i + 1, action: `${workflow.steps[i].action} (retry)`,
					status: 'success', duration: Math.random() * 5000,
				});
				completed++;
			}
		} else {
			results.push({
				step: i + 1, action: workflow.steps[i].action,
				status: 'success', duration: Math.random() * 5000,
			});
			completed++;
		}
	}

	const overallStatus: WorkflowRunStatus = aborted ? 'failed'
		: completed === workflow.steps.length ? 'completed' : 'completed';

	return {
		workflowId: workflow.id,
		status: overallStatus,
		stepsCompleted: completed,
		stepsTotal: workflow.steps.length,
		results,
		startedAt: new Date(Date.now() - 60_000).toISOString(),
		completedAt: new Date().toISOString(),
	};
}

describe('Workflow Automation Scenarios', () => {
	describe('Workflow Schema Validation', () => {
		it('should accept valid security scan workflow', () => {
			const input = {
				name: 'Nightly Security Scan',
				workflowType: 'security_scan',
				triggerType: 'cron' as const,
				triggerConfig: { schedule: '0 3 * * *' },
				steps: [
					{ action: 'sync_users', onFailure: 'abort' as const },
					{ action: 'run_cis_benchmark', onFailure: 'skip' as const },
					{ action: 'generate_report', onFailure: 'retry' as const },
				],
				requiresApproval: false,
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(true);
		});

		it('should accept webhook-triggered workflow', () => {
			const input = {
				name: 'Alert Response Workflow',
				workflowType: 'incident_response',
				triggerType: 'webhook' as const,
				steps: [
					{ action: 'acknowledge_alert', onFailure: 'abort' as const },
					{ action: 'notify_team', onFailure: 'skip' as const },
				],
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(true);
		});

		it('should accept manual workflow with approval', () => {
			const input = {
				name: 'User Decommission',
				workflowType: 'user_lifecycle',
				triggerType: 'manual' as const,
				steps: [
					{ action: 'disable_account', onFailure: 'abort' as const },
					{ action: 'revoke_sessions', onFailure: 'abort' as const },
					{ action: 'remove_licenses', onFailure: 'retry' as const },
				],
				requiresApproval: true,
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.requiresApproval).toBe(true);
			}
		});

		it('should reject workflow with empty steps', () => {
			const input = {
				name: 'Empty Workflow',
				workflowType: 'test',
				triggerType: 'manual' as const,
				steps: [],
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		it('should reject workflow with empty name', () => {
			const input = {
				name: '',
				workflowType: 'test',
				triggerType: 'manual' as const,
				steps: [{ action: 'test', onFailure: 'skip' as const }],
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		it('should reject invalid trigger type', () => {
			const input = {
				name: 'Bad Trigger',
				workflowType: 'test',
				triggerType: 'invalid_trigger',
				steps: [{ action: 'test', onFailure: 'skip' as const }],
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		it('should reject step with invalid onFailure', () => {
			const input = {
				name: 'Bad Step',
				workflowType: 'test',
				triggerType: 'manual' as const,
				steps: [{ action: 'test', onFailure: 'explode' }],
			};
			const result = workflowCreateSchema.safeParse(input);
			expect(result.success).toBe(false);
		});

		it('should accept all valid trigger types', () => {
			const triggerTypes: WorkflowTriggerType[] = ['cron', 'webhook', 'manual', 'conditional'];
			for (const triggerType of triggerTypes) {
				const result = workflowCreateSchema.safeParse({
					name: `Trigger ${triggerType}`,
					workflowType: 'test',
					triggerType,
					steps: [{ action: 'noop', onFailure: 'skip' as const }],
				});
				expect(result.success).toBe(true);
			}
		});
	});

	describe('Workflow Execution — All Steps Succeed', () => {
		const workflow = makeWorkflow({
			name: 'Full Security Scan',
			steps: [
				{ action: 'sync_users', onFailure: 'abort' },
				{ action: 'run_security_scan', onFailure: 'skip' },
				{ action: 'run_cis_benchmark', onFailure: 'skip' },
				{ action: 'generate_report', onFailure: 'retry' },
			],
		});

		const result = executeWorkflow(workflow, ['success', 'success', 'success', 'success']);

		it('should complete all steps', () => {
			expect(result.stepsCompleted).toBe(4);
			expect(result.stepsTotal).toBe(4);
		});

		it('should report completed status', () => {
			expect(result.status).toBe('completed');
		});

		it('should have all steps as success', () => {
			const successes = result.results.filter((r) => r.status === 'success');
			expect(successes.length).toBe(4);
		});

		it('should have timestamps', () => {
			expect(new Date(result.startedAt).getTime()).toBeLessThan(
				new Date(result.completedAt).getTime()
			);
		});
	});

	describe('Workflow Execution — Abort on Critical Failure', () => {
		const workflow = makeWorkflow({
			name: 'Critical Path Workflow',
			steps: [
				{ action: 'sync_users', onFailure: 'abort' },
				{ action: 'analyze_security', onFailure: 'abort' },
				{ action: 'send_report', onFailure: 'skip' },
			],
		});

		const result = executeWorkflow(workflow, ['success', 'failed', 'success']);

		it('should abort after second step failure', () => {
			expect(result.status).toBe('failed');
		});

		it('should skip remaining steps after abort', () => {
			const skipped = result.results.filter((r) => r.status === 'skipped');
			expect(skipped.length).toBe(1);
			expect(skipped[0].action).toBe('send_report');
		});

		it('should only complete 1 of 3 steps', () => {
			expect(result.stepsCompleted).toBe(1);
		});
	});

	describe('Workflow Execution — Skip on Non-Critical Failure', () => {
		const workflow = makeWorkflow({
			name: 'Resilient Workflow',
			steps: [
				{ action: 'sync_users', onFailure: 'skip' },
				{ action: 'run_optional_check', onFailure: 'skip' },
				{ action: 'generate_report', onFailure: 'skip' },
			],
		});

		const result = executeWorkflow(workflow, ['success', 'failed', 'success']);

		it('should continue after skipped failure', () => {
			expect(result.status).toBe('completed');
		});

		it('should complete 2 of 3 steps', () => {
			expect(result.stepsCompleted).toBe(2);
		});
	});

	describe('Workflow Execution — Retry on Transient Failure', () => {
		const workflow = makeWorkflow({
			name: 'Retry Workflow',
			steps: [
				{ action: 'call_graph_api', onFailure: 'retry' },
				{ action: 'process_results', onFailure: 'abort' },
			],
		});

		const result = executeWorkflow(workflow, ['failed', 'success']);

		it('should retry failed step and succeed', () => {
			const retries = result.results.filter((r) => r.action.includes('retry'));
			expect(retries.length).toBe(1);
			expect(retries[0].status).toBe('success');
		});

		it('should complete all steps after retry', () => {
			expect(result.stepsCompleted).toBe(2);
			expect(result.status).toBe('completed');
		});
	});

	describe('Workflow Templates', () => {
		it('should create a security scan workflow', () => {
			const wf = makeWorkflow({
				name: 'Security Scan', workflowType: 'security_scan',
				triggerType: 'cron', triggerConfig: { schedule: '0 * * * *' },
			});
			expect(wf.workflowType).toBe('security_scan');
			expect(wf.triggerType).toBe('cron');
			expect(wf.enabled).toBe(true);
		});

		it('should create a user lifecycle workflow', () => {
			const wf = makeWorkflow({
				name: 'User Offboarding', workflowType: 'user_lifecycle',
				triggerType: 'manual', requiresApproval: true,
				steps: [
					{ action: 'disable_account', onFailure: 'abort' },
					{ action: 'revoke_sessions', onFailure: 'abort' },
					{ action: 'remove_licenses', onFailure: 'retry' },
					{ action: 'archive_mailbox', onFailure: 'skip' },
				],
			});
			expect(wf.requiresApproval).toBe(true);
			expect(wf.steps.length).toBe(4);
		});

		it('should create a compliance check workflow', () => {
			const wf = makeWorkflow({
				name: 'Daily Compliance', workflowType: 'compliance_check',
				triggerType: 'cron', triggerConfig: { schedule: '0 3 * * *' },
				steps: [
					{ action: 'run_cis_benchmark', onFailure: 'skip' },
					{ action: 'check_drift', onFailure: 'skip' },
					{ action: 'notify_if_drift', condition: 'drift_detected', onFailure: 'retry' },
				],
			});
			expect(wf.steps[2].condition).toBe('drift_detected');
		});
	});
});
