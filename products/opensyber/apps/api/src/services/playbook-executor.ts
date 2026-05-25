/**
 * Playbook Executor — State Machine
 *
 * Executes remediation playbook steps with real infrastructure actions.
 * Each step type maps to a concrete service call (Hetzner, KV, DB, etc.).
 * States: pending -> running -> step_N -> completed | failed
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../types.js';
import { runStepAction } from './playbook-steps.js';

export type StepType =
  | 'api_call' | 'notification' | 'approval_gate' | 'script'
  | 'suspend_agent' | 'revoke_secret' | 'notify' | 'block_ip'
  | 'rotate_credential' | 'quarantine_file' | 'create_incident' | 'webhook';

export type RunState = 'pending' | 'running' | `step_${number}` | 'completed' | 'failed';

export interface PlaybookStep {
  name: string;
  type: StepType;
  config: Record<string, unknown>;
  rollback?: { type: StepType; config: Record<string, unknown> };
}

export interface StepResult {
  stepIndex: number;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  output?: string;
  durationMs: number;
}

export interface PlaybookResult {
  status: 'completed' | 'failed';
  stepResults: StepResult[];
  totalDurationMs: number;
  currentStep: number;
  completedSteps: number;
  error?: string;
}

export interface RunStateUpdate {
  runId: string;
  state: RunState;
  currentStep: number;
  completedSteps: number;
}

export interface ExecutionContext {
  env: Env;
  db: DrizzleD1Database<Record<string, unknown>>;
  orgId: string;
}

function buildOutput(step: PlaybookStep): string {
  const c = step.config;
  switch (step.type) {
    case 'api_call': return `API call to ${c.url ?? c.endpoint ?? 'target'}`;
    case 'notification': return `Notified ${c.channel ?? c.target ?? 'default'}`;
    case 'approval_gate': return `Approval granted (auto-approved in executor)`;
    case 'script': return `Script executed: ${c.command ?? c.scriptId ?? 'inline'}`;
    case 'suspend_agent': return `Agent ${c.agentId ?? 'unknown'} suspended`;
    case 'revoke_secret': return `Secret ${c.secretName ?? 'unknown'} revoked`;
    case 'notify': return `Notification sent to ${c.channel ?? 'default'}`;
    case 'create_incident': return 'Incident created';
    case 'webhook': return `Webhook called: ${c.url ?? ''}`;
    default: return `Step type ${step.type} executed`;
  }
}

async function executeStep(
  step: PlaybookStep, index: number, ctx?: ExecutionContext,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const output = ctx
      ? await runStepAction(step, ctx)
      : buildOutput(step);
    return { stepIndex: index, name: step.name, status: 'success',
      output, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Step execution failed';
    return { stepIndex: index, name: step.name, status: 'failed',
      output: msg, durationMs: Date.now() - start };
  }
}

async function executeRollback(
  steps: PlaybookStep[], failedIndex: number, ctx?: ExecutionContext,
): Promise<StepResult[]> {
  const rollbackResults: StepResult[] = [];
  for (let i = failedIndex - 1; i >= 0; i--) {
    const step = steps[i]!;
    if (!step.rollback) continue;
    const rollbackStep: PlaybookStep = {
      name: `rollback:${step.name}`, type: step.rollback.type, config: step.rollback.config,
    };
    const result = await executeStep(rollbackStep, i, ctx);
    rollbackResults.push({ ...result, name: `rollback:${step.name}` });
  }
  return rollbackResults;
}

/** Execute a playbook with state machine tracking and rollback support. */
export async function executePlaybook(
  steps: PlaybookStep[], ctx?: ExecutionContext,
): Promise<PlaybookResult> {
  const start = Date.now();
  const stepResults: StepResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    const result = await executeStep(steps[i]!, i, ctx);
    stepResults.push(result);

    if (result.status === 'failed') {
      const rollbackResults = await executeRollback(steps, i, ctx);
      stepResults.push(...rollbackResults);
      return {
        status: 'failed', stepResults, totalDurationMs: Date.now() - start,
        currentStep: i, completedSteps: i, error: `Step "${steps[i]!.name}" failed`,
      };
    }
  }

  return {
    status: 'completed', stepResults, totalDurationMs: Date.now() - start,
    currentStep: steps.length, completedSteps: steps.length,
  };
}

/** Compute the current state label for a running playbook. */
export function computeState(totalSteps: number, completedSteps: number, failed: boolean): RunState {
  if (failed) return 'failed';
  if (completedSteps === 0) return 'running';
  if (completedSteps >= totalSteps) return 'completed';
  return `step_${completedSteps}`;
}

export function parseSteps(stepsJson: string): PlaybookStep[] {
  const parsed = JSON.parse(stepsJson);
  if (!Array.isArray(parsed)) throw new Error('Steps must be an array');
  return parsed as PlaybookStep[];
}

/** Check if a trigger condition matches (for auto-remediation). */
export function shouldAutoTrigger(
  triggerType: string,
  triggerConfig: Record<string, unknown> | null,
  event: { severity?: string; type?: string },
): boolean {
  if (triggerType !== 'auto' || !triggerConfig) return false;
  const minSeverity = triggerConfig.minSeverity as string | undefined;
  const eventTypes = triggerConfig.eventTypes as string[] | undefined;
  const severityRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  if (minSeverity && event.severity) {
    if ((severityRank[event.severity] ?? 0) < (severityRank[minSeverity] ?? 0)) return false;
  }
  if (eventTypes && event.type && !eventTypes.includes(event.type)) return false;
  return true;
}
