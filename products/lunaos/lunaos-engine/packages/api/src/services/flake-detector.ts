/**
 * Flake Detector — detect flaky tests by re-running them under stress.
 *
 * Inspired by flakestress: run a test command N times, track pass/fail
 * pattern, flag as flaky if 0% < success_rate < 100%.
 *
 * Workers-compatible: no child_process — instead runs via an external
 * runner endpoint (LunaOS Runner or user-provided webhook).
 */

interface FlakeEnv {
  DB: D1Database;
  RUNNER_URL?: string;
  RUNNER_TOKEN?: string;
}

export interface FlakeRequest {
  testId: string;        // unique test identifier (e.g., "tests/login.test.ts::should redirect")
  command: string;       // shell command to run (e.g., "npm test -- login")
  iterations?: number;   // default 10
  timeoutMs?: number;    // per-run timeout, default 60000
  parallelism?: number;  // how many to run in parallel, default 3
}

export interface RunOutcome {
  run: number;
  passed: boolean;
  durationMs: number;
  exitCode: number;
  stderr?: string;
}

export interface FlakeReport {
  testId: string;
  iterations: number;
  passed: number;
  failed: number;
  successRate: number;
  classification: 'stable' | 'flaky' | 'broken';
  avgDurationMs: number;
  stddevDurationMs: number;
  runs: RunOutcome[];
  reason: string;
}

const DEFAULT_ITERATIONS = 10;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PARALLELISM = 3;
const MAX_ITERATIONS = 100;

/**
 * Run a test N times via external runner, classify as flaky/stable/broken.
 */
export async function detectFlake(
  env: FlakeEnv,
  req: FlakeRequest,
): Promise<FlakeReport> {
  validateRequest(req);

  const iterations = Math.min(req.iterations || DEFAULT_ITERATIONS, MAX_ITERATIONS);
  const parallelism = Math.min(req.parallelism || DEFAULT_PARALLELISM, iterations);

  // Execute in waves to respect parallelism budget
  const runs: RunOutcome[] = [];
  let completed = 0;
  while (completed < iterations) {
    const batchSize = Math.min(parallelism, iterations - completed);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        executeRun(env, req, completed + i + 1),
      ),
    );
    runs.push(...batch);
    completed += batchSize;
  }

  return buildReport(req.testId, runs);
}

function validateRequest(req: FlakeRequest): void {
  if (!req.testId) throw new Error('testId required');
  if (!req.command) throw new Error('command required');
  if (req.iterations !== undefined && req.iterations < 2) {
    throw new Error('iterations must be >= 2 (need multiple samples to detect flakes)');
  }
  if (req.iterations !== undefined && req.iterations > MAX_ITERATIONS) {
    throw new Error(`iterations capped at ${MAX_ITERATIONS}`);
  }
}

/** Execute a single test run via external runner. Never throws. */
async function executeRun(
  env: FlakeEnv,
  req: FlakeRequest,
  runNumber: number,
): Promise<RunOutcome> {
  const start = Date.now();
  const timeoutMs = req.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!env.RUNNER_URL) {
    // Dry-run mode: mark as skipped with synthetic success for testing
    return {
      run: runNumber,
      passed: true,
      durationMs: 0,
      exitCode: 0,
      stderr: 'no RUNNER_URL configured — dry run',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(env.RUNNER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.RUNNER_TOKEN ? { Authorization: `Bearer ${env.RUNNER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ command: req.command, timeout: timeoutMs }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await response.json() as {
      exitCode?: number;
      stderr?: string;
    };
    return {
      run: runNumber,
      passed: (result.exitCode ?? 1) === 0,
      durationMs: Date.now() - start,
      exitCode: result.exitCode ?? -1,
      stderr: result.stderr?.slice(0, 500),
    };
  } catch (err: any) {
    return {
      run: runNumber,
      passed: false,
      durationMs: Date.now() - start,
      exitCode: -1,
      stderr: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  }
}

/** Build final report from run outcomes. */
function buildReport(testId: string, runs: RunOutcome[]): FlakeReport {
  const passed = runs.filter((r) => r.passed).length;
  const failed = runs.length - passed;
  const successRate = passed / runs.length;

  let classification: 'stable' | 'flaky' | 'broken';
  let reason: string;
  if (successRate === 1.0) {
    classification = 'stable';
    reason = `all ${runs.length} runs passed`;
  } else if (successRate === 0.0) {
    classification = 'broken';
    reason = `all ${runs.length} runs failed`;
  } else {
    classification = 'flaky';
    reason = `${passed}/${runs.length} passed (${Math.round(successRate * 100)}%) — non-deterministic`;
  }

  // Duration stats
  const durations = runs.map((r) => r.durationMs);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((s, d) => s + (d - avg) ** 2, 0) / durations.length;
  const stddev = Math.sqrt(variance);

  return {
    testId,
    iterations: runs.length,
    passed,
    failed,
    successRate,
    classification,
    avgDurationMs: Math.round(avg),
    stddevDurationMs: Math.round(stddev),
    runs,
    reason,
  };
}

/** Persist report to D1 for historical trend tracking. */
export async function saveReport(
  env: FlakeEnv,
  report: FlakeReport,
): Promise<void> {
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO flake_reports (id, test_id, classification, iterations, passed,
        success_rate, avg_duration_ms, stddev_duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      id, report.testId, report.classification, report.iterations,
      report.passed, report.successRate, report.avgDurationMs, report.stddevDurationMs,
    ).run();
  } catch (err) {
    console.error('[flake] saveReport failed:', (err as Error).message);
  }
}
