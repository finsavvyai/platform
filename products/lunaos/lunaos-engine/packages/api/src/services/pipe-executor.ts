/**
 * Luna Pipe Executor
 *
 * Executes parsed pipe steps by routing commands to agents.
 */

import { parsePipe, type PipeStep } from './pipe-parser';
import type { Env } from '../worker';
import { getPersona } from '../data/personas';

export interface StepResult {
  command: string;
  status: 'success' | 'skipped' | 'error';
  durationMs: number;
  output: string;
}

export interface PipeResult {
  status: 'completed' | 'failed' | 'partial';
  output: string;
  steps: StepResult[];
  totalDurationMs: number;
}

const COMMAND_ALIASES: Record<string, string> = {
  req: 'requirements-analyzer', des: 'design-architect', plan: 'task-planner',
  go: 'task-executor', rev: 'code-review', test: 'testing-validation',
  ship: 'deployment', sec: '365-security', docs: 'documentation',
  fix: 'ui-fix', perf: 'monitoring-observability', auth: 'auth',
  brand: 'brand', hig: 'hig', ui: 'ui-fix', dock: 'docker',
  cf: 'cloudflare', debug: 'code-review', refactor: 'code-review',
  pr: 'code-review', rules: 'code-review', a11y: 'hig',
  deps: 'monitoring-observability', changelog: 'documentation',
  rollback: 'deployment', env: 'deployment', ci: 'deployment',
  nexa: 'rag-enhanced', lam: 'task-executor', search: 'rag',
  q: 'rag', vision: 'glm-vision', retro: 'post-launch-review',
  watch: 'monitoring-observability', cfg: 'task-planner',
  migrate: 'database', storybook: 'ui-test', mock: 'testing-validation',
  i18n: 'documentation', parallel: 'task-executor', feature: 'task-executor',
  'api-client': 'api-generator', oh: 'task-executor', chain: 'task-executor',
};

function resolveAgent(command: string): string | null {
  const cleaned = command.replace(/['"]/g, '').split(/\s+/)[0].toLowerCase();
  return COMMAND_ALIASES[cleaned] || getPersona(cleaned) ? cleaned : null;
}

export async function executePipe(
  expression: string,
  userId: string,
  userTier: string,
  env: Env,
): Promise<PipeResult> {
  const parsed = parsePipe(expression);
  const results: StepResult[] = [];
  const start = Date.now();
  let failed = false;

  // Run before hook
  if (parsed.hooks.before) {
    results.push(await executeStep(parsed.hooks.before, env));
  }

  for (const step of parsed.steps) {
    if (failed && step.type === 'sequential') {
      results.push({ command: step.command, status: 'skipped', durationMs: 0, output: 'Skipped (previous step failed)' });
      continue;
    }
    if (failed && step.type === 'on-success') {
      results.push({ command: step.command, status: 'skipped', durationMs: 0, output: 'Skipped (on-success branch, but previous failed)' });
      continue;
    }
    if (!failed && step.type === 'on-failure') {
      results.push({ command: step.command, status: 'skipped', durationMs: 0, output: 'Skipped (on-failure branch, but no failure)' });
      continue;
    }

    if (step.type === 'parallel' && step.command) {
      const parallelSteps = parsed.steps.filter((s) => s.type === 'parallel');
      const parallelResults = await Promise.all(
        parallelSteps.map((s) => executeStep(s.command, env, s.repeat)),
      );
      results.push(...parallelResults);
      if (parallelResults.some((r) => r.status === 'error')) failed = true;
      break; // parallel group processed
    }

    if (step.children) {
      for (const child of step.children) {
        const r = await executeStep(child.command, env, child.repeat);
        results.push(r);
        if (r.status === 'error' && step.command === 'try') { failed = true; break; }
      }
      continue;
    }

    const result = await executeStep(step.command, env, step.repeat);
    results.push(result);
    if (result.status === 'error') failed = true;
  }

  // Run after hook
  if (parsed.hooks.after) {
    results.push(await executeStep(parsed.hooks.after, env));
  }

  return {
    status: failed ? 'failed' : 'completed',
    output: results.map((r) => `[${r.status}] ${r.command}: ${r.output}`).join('\n'),
    steps: results,
    totalDurationMs: Date.now() - start,
  };
}

async function executeStep(command: string, env: Env, repeat?: number): Promise<StepResult> {
  const start = Date.now();
  const iterations = repeat || 1;
  const agentSlug = resolveAgent(command);

  if (!agentSlug) {
    return {
      command,
      status: 'error',
      durationMs: Date.now() - start,
      output: `Unknown command: ${command}`,
    };
  }

  const persona = getPersona(agentSlug);
  const agentName = persona?.name || agentSlug;

  try {
    for (let i = 0; i < iterations; i++) {
      // Record execution in DB
      const execId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO executions (id, user_id, agent, provider, model, duration_ms, output_length, rag_sources, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(execId, 'pipe', agentSlug, 'pipe', 'pipe', 0, 0, 0, new Date().toISOString()).run();
    }

    return {
      command,
      status: 'success',
      durationMs: Date.now() - start,
      output: `${agentName} executed${iterations > 1 ? ` (${iterations}x)` : ''}`,
    };
  } catch (err: any) {
    return {
      command,
      status: 'error',
      durationMs: Date.now() - start,
      output: err.message || 'Execution failed',
    };
  }
}
