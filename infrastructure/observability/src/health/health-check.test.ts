import { describe, it, expect } from "vitest";

import { createHealthRunner, type NamedCheck } from "./health-check.js";
import type { HealthStatus } from "../types.js";

const okCheck = (name: string): NamedCheck => ({
  name,
  check: async () => "ok" as HealthStatus,
});

const status = (name: string, s: HealthStatus): NamedCheck => ({
  name,
  check: async () => s,
});

const sleepyCheck = (name: string, ms: number, s: HealthStatus): NamedCheck => ({
  name,
  check: () =>
    new Promise<HealthStatus>((resolve) => setTimeout(() => resolve(s), ms)),
});

describe("health-check runner", () => {
  it("aggregates to ok when all checks return ok", async () => {
    const run = createHealthRunner({
      version: "1.0.0",
      uptimeS: () => 42,
    });
    const report = await run([okCheck("db"), okCheck("queue")]);
    expect(report.status).toBe("ok");
    expect(report.version).toBe("1.0.0");
    expect(report.uptime_s).toBe(42);
    expect(report.checks).toHaveLength(2);
    expect(report.checks.map((c) => c.status)).toEqual(["ok", "ok"]);
  });

  it("aggregates to degraded when at least one is degraded and none down", async () => {
    const run = createHealthRunner({ version: "1", uptimeS: () => 0 });
    const report = await run([
      okCheck("a"),
      status("b", "degraded"),
      okCheck("c"),
    ]);
    expect(report.status).toBe("degraded");
  });

  it("aggregates to down when any check is down", async () => {
    const run = createHealthRunner({ version: "1", uptimeS: () => 0 });
    const report = await run([
      okCheck("a"),
      status("b", "degraded"),
      status("c", "down"),
    ]);
    expect(report.status).toBe("down");
  });

  it("treats a check throwing as down", async () => {
    const run = createHealthRunner({ version: "1", uptimeS: () => 0 });
    const report = await run([
      okCheck("a"),
      {
        name: "bad",
        check: async () => {
          throw new Error("explode");
        },
      },
    ]);
    expect(report.status).toBe("down");
    const bad = report.checks.find((c) => c.name === "bad");
    expect(bad?.status).toBe("down");
  });

  it("treats a timed-out check as down", async () => {
    const run = createHealthRunner({
      version: "1",
      uptimeS: () => 0,
      timeoutMs: 20,
    });
    const report = await run([sleepyCheck("slow", 200, "ok")]);
    expect(report.status).toBe("down");
    expect(report.checks[0]!.status).toBe("down");
  });

  it("honours per-check timeoutMs override", async () => {
    const run = createHealthRunner({
      version: "1",
      uptimeS: () => 0,
      timeoutMs: 5,
    });
    const report = await run([
      { ...sleepyCheck("fast-allow", 50, "ok"), timeoutMs: 500 },
    ]);
    expect(report.status).toBe("ok");
  });

  it("empty checks list aggregates to ok", async () => {
    const run = createHealthRunner({ version: "1", uptimeS: () => 0 });
    const report = await run([]);
    expect(report.status).toBe("ok");
    expect(report.checks).toEqual([]);
  });

  it("default uptimeS produces a non-negative integer", async () => {
    const run = createHealthRunner({ version: "1" });
    const report = await run([okCheck("a")]);
    expect(Number.isInteger(report.uptime_s)).toBe(true);
    expect(report.uptime_s).toBeGreaterThanOrEqual(0);
  });
});
