import { eq } from 'drizzle-orm';
import { tfRunbookRuns, tfRunbookStepLogs } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ActionFn,
  Runbook,
  RunbookContext,
  RunbookRunState,
  RunbookServices,
  Step,
} from './types.js';
import { ACTIONS } from './actions/index.js';

interface ExecuteOptions {
  db: DrizzleD1Database<Record<string, unknown>>;
  runbook: Runbook;
  ownerUserId: string;
  orgId: string | null;
  triggerAlertId?: string | null;
  triggerSource?: string;
  params?: Record<string, unknown>;
  // Override action registry (for tests).
  actions?: Record<string, ActionFn>;
  // Service handles passed through to actions (alert dispatcher, AI, etc).
  services?: RunbookServices;
}

function nowIso(): string {
  return new Date().toISOString();
}

function indexById(steps: Step[]): Map<string, number> {
  const m = new Map<string, number>();
  steps.forEach((s, i) => m.set(s.id, i));
  return m;
}

async function persistStepStart(
  db: ExecuteOptions['db'],
  runId: string,
  stepIndex: number,
  step: Step,
): Promise<string> {
  const logId = generateId();
  await db.insert(tfRunbookStepLogs).values({
    id: logId,
    runId,
    stepIndex,
    action: step.action,
    inputJson: JSON.stringify(step.params ?? {}),
    status: 'running',
    startedAt: nowIso(),
  });
  return logId;
}

async function persistStepEnd(
  db: ExecuteOptions['db'],
  logId: string,
  status: 'success' | 'error',
  output: unknown,
  errorMessage?: string,
): Promise<void> {
  await db
    .update(tfRunbookStepLogs)
    .set({
      status,
      outputJson: output === undefined ? null : JSON.stringify(output),
      errorMessage: errorMessage ?? null,
      completedAt: nowIso(),
    })
    .where(eq(tfRunbookStepLogs.id, logId));
}

/**
 * Execute a runbook end-to-end. Persists run state + per-step logs.
 *
 * Step navigation rules:
 *   - on success: jump to step.on_success (by id) or fall through to next.
 *   - on error: honour step.on_error.mode — 'fail' aborts, 'continue' moves
 *     forward, 'jump_to' jumps to step.on_error.target.
 *   - reaching the end of the steps array completes the run.
 */
export async function executeRunbook(
  opts: ExecuteOptions,
): Promise<RunbookRunState> {
  const {
    db, runbook, ownerUserId, orgId,
    triggerAlertId = null, triggerSource = 'manual',
    params = {}, actions = ACTIONS,
    services = {},
  } = opts;

  const runId = generateId();
  const stepIdx = indexById(runbook.steps);

  await db.insert(tfRunbookRuns).values({
    id: runId,
    runbookId: runbook.id,
    triggerAlertId,
    triggerSource,
    status: 'running',
    startedAt: nowIso(),
    currentStepIndex: 0,
    ownerUserId,
    orgId,
  });

  const ctx: RunbookContext = {
    runId, runbookId: runbook.id, triggerAlertId,
    ownerUserId, orgId, prevOutputs: {}, params, services,
  };

  let cursor = 0;
  let executed = 0;
  while (cursor < runbook.steps.length) {
    const step = runbook.steps[cursor];
    if (!step) break; // unreachable under noUncheckedIndexedAccess but keeps tsc happy
    await db
      .update(tfRunbookRuns)
      .set({ currentStepIndex: cursor })
      .where(eq(tfRunbookRuns.id, runId));

    const logId = await persistStepStart(db, runId, cursor, step);
    const action = actions[step.action];
    let result;
    if (!action) {
      result = { ok: false, error: `unknown action: ${step.action}` };
    } else {
      try { result = await action(step, ctx); }
      catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    await persistStepEnd(
      db, logId,
      result.ok ? 'success' : 'error',
      result.output,
      result.error,
    );
    executed++;

    if (result.ok) {
      ctx.prevOutputs[step.id] = result.output;
      cursor = step.on_success ? (stepIdx.get(step.on_success) ?? cursor + 1) : cursor + 1;
      continue;
    }

    const oe = step.on_error;
    if (oe.mode === 'fail') {
      await db.update(tfRunbookRuns).set({
        status: 'failed', completedAt: nowIso(),
      }).where(eq(tfRunbookRuns.id, runId));
      return { runId, status: 'failed', stepsExecuted: executed, failedAtStep: step.id, error: result.error };
    }
    if (oe.mode === 'jump_to' && oe.target && stepIdx.has(oe.target)) {
      cursor = stepIdx.get(oe.target)!;
      continue;
    }
    cursor++;
  }

  await db.update(tfRunbookRuns).set({
    status: 'completed', completedAt: nowIso(),
  }).where(eq(tfRunbookRuns.id, runId));
  return { runId, status: 'completed', stepsExecuted: executed };
}
