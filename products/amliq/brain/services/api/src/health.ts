/**
 * Health-snapshot builder for AMLIQ Brain.
 *
 * Output shape matches the round-3 mesh contract §1:
 *   { status, version, uptime_s, checks: [{ name, status }] }
 *
 * Status aggregation rules (mesh consensus):
 *   - any "down"      → snapshot "down"
 *   - any "degraded"  → snapshot "degraded"
 *   - otherwise       → "ok"
 *
 * Probes are awaited in parallel. A probe that throws is recorded as a
 * synthetic "down" check named after itself; we do NOT let one probe
 * sink the whole endpoint by throwing.
 */

import type {
  HealthCheck,
  HealthProbe,
  HealthSnapshot,
  HealthStatus,
} from "./types.js";

const safeRun = async (
  probe: HealthProbe,
  idx: number,
): Promise<HealthCheck> => {
  try {
    const out = await probe();
    if (!out || typeof out.name !== "string" || !out.status) {
      return { name: `probe_${idx}`, status: "down" };
    }
    return out;
  } catch {
    return { name: `probe_${idx}`, status: "down" };
  }
};

const aggregate = (checks: readonly HealthCheck[]): HealthStatus => {
  let degraded = false;
  for (const c of checks) {
    if (c.status === "down") return "down";
    if (c.status === "degraded") degraded = true;
  }
  return degraded ? "degraded" : "ok";
};

export interface HealthBuilderOptions {
  readonly version: string;
  readonly startedAtMs: number;
  readonly probes?: readonly HealthProbe[];
  readonly clock?: () => number;
}

export class HealthBuilder {
  private readonly version: string;
  private readonly startedAtMs: number;
  private readonly probes: readonly HealthProbe[];
  private readonly now: () => number;

  constructor(opts: HealthBuilderOptions) {
    this.version = opts.version;
    this.startedAtMs = opts.startedAtMs;
    this.probes = opts.probes ?? [];
    this.now = opts.clock ?? (() => Date.now());
  }

  async snapshot(): Promise<HealthSnapshot> {
    const checks = await Promise.all(
      this.probes.map((p, i) => safeRun(p, i)),
    );
    const uptime_s = Math.max(
      0,
      Math.floor((this.now() - this.startedAtMs) / 1000),
    );
    return {
      status: aggregate(checks),
      version: this.version,
      uptime_s,
      checks,
    };
  }
}
