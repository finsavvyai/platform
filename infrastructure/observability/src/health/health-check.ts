/**
 * Health-check helper — implements cross-agent contract §1.
 *
 * Return shape:
 *   {
 *     status: "ok" | "degraded" | "down",
 *     version: string,
 *     uptime_s: number,
 *     checks: [{ name, status }]
 *   }
 *
 * Aggregation:
 *   any down       → down
 *   else any degraded → degraded
 *   else            → ok
 *
 * Per-check timeout: each check has `timeoutMs`. On timeout the check is
 * recorded as "down". Exceptions thrown by a check are recorded as "down".
 */

import type {
  HealthCheckResult,
  HealthReport,
  HealthStatus,
} from "../types.js";

export type NamedCheck = {
  readonly name: string;
  readonly check: () => Promise<HealthStatus>;
  /** Per-check timeout in ms. Defaults to runner's `timeoutMs`. */
  readonly timeoutMs?: number;
};

export type HealthRunnerOptions = {
  readonly version: string;
  /** Returns process uptime in seconds. Defaults to monotonic since module load. */
  readonly uptimeS?: () => number;
  /** Default per-check timeout. Default 2_000ms. */
  readonly timeoutMs?: number;
};

const aggregate = (
  results: ReadonlyArray<HealthCheckResult>,
): HealthStatus => {
  if (results.some((r) => r.status === "down")) return "down";
  if (results.some((r) => r.status === "degraded")) return "degraded";
  return "ok";
};

const runWithTimeout = async (
  check: NamedCheck,
  defaultTimeoutMs: number,
): Promise<HealthCheckResult> => {
  const timeoutMs = check.timeoutMs ?? defaultTimeoutMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise: Promise<HealthStatus> = new Promise((resolve) => {
    timer = setTimeout(() => resolve("down"), timeoutMs);
  });
  try {
    const status = await Promise.race([
      check.check().catch((): HealthStatus => "down"),
      timeoutPromise,
    ]);
    return { name: check.name, status };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
};

const moduleLoadMs = Date.now();

export const createHealthRunner = (
  options: HealthRunnerOptions,
): ((checks: ReadonlyArray<NamedCheck>) => Promise<HealthReport>) => {
  const uptimeS =
    options.uptimeS ?? (() => Math.floor((Date.now() - moduleLoadMs) / 1000));
  const defaultTimeoutMs = options.timeoutMs ?? 2_000;

  return async (
    checks: ReadonlyArray<NamedCheck>,
  ): Promise<HealthReport> => {
    const results = await Promise.all(
      checks.map((c) => runWithTimeout(c, defaultTimeoutMs)),
    );
    return {
      status: aggregate(results),
      version: options.version,
      uptime_s: uptimeS(),
      checks: results,
    };
  };
};
