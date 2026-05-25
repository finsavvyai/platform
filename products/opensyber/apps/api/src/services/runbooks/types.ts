import { z } from 'zod';

/**
 * Runbook engine — types and zod schemas.
 *
 * A *Runbook* is a JSON definition (versioned in skills/runbooks/*.json) that
 * describes an incident playbook: a trigger pattern + ordered list of steps.
 * Each step invokes a registered Action and decides where to go next based
 * on success/error.
 */

export const stepOnErrorSchema = z.object({
  // 'continue' moves to the next step despite the error.
  // 'fail' aborts the run and marks it failed.
  // 'jump_to' jumps to the named step (matched by step.id).
  mode: z.enum(['continue', 'fail', 'jump_to']),
  target: z.string().optional(),
});

export const stepSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  // 'next' (optional) — id of next step on success. Defaults to sequential.
  on_success: z.string().optional(),
  on_error: stepOnErrorSchema.default({ mode: 'fail' }),
});

export const runbookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  // Trigger spec: alert pattern (e.g., {"severity": "high", "type": "phishing"}).
  // Loader matches incoming triggers against this object via shallow equality.
  trigger: z.record(z.unknown()).default({}),
  steps: z.array(stepSchema).min(1),
});

export type StepOnError = z.infer<typeof stepOnErrorSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Runbook = z.infer<typeof runbookSchema>;

/**
 * Result returned by an Action handler. The engine persists `output` as JSON
 * into tf_runbook_step_logs.output_json.
 */
export interface StepResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Service handles available to action handlers at execution time.
 * Provided by the executor caller (route handler). Optional so unit tests
 * can run actions without booting a Worker.
 */
export interface RunbookServices {
  db?: unknown;
  kv?: unknown;
  env?: Record<string, unknown>;
  // Decrypts AES-GCM blobs stored in alert_channels.config etc.
  decryptFn?: (encrypted: string) => Promise<string>;
}

/**
 * Context passed to action handlers. Holds run metadata + previous step
 * outputs so later steps can chain. Actions MUST treat ctx.params /
 * ctx.prevOutputs as read-only — the engine clones what it persists.
 */
export interface RunbookContext {
  runId: string;
  runbookId: string;
  triggerAlertId: string | null;
  ownerUserId: string;
  orgId: string | null;
  // Outputs from previous successful steps, keyed by step.id.
  prevOutputs: Record<string, unknown>;
  // Bag of params supplied at trigger time (POST body.params).
  params: Record<string, unknown>;
  // Service handles for actions that need to reach out beyond the engine
  // (alert dispatcher, AI gateway, etc). Empty in unit tests.
  services: RunbookServices;
}

export type ActionFn = (
  step: Step,
  ctx: RunbookContext,
) => Promise<StepResult>;

/**
 * Final state returned by executor.run().
 */
export interface RunbookRunState {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled';
  stepsExecuted: number;
  failedAtStep?: string;
  error?: string;
}
