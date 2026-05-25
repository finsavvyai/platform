import { describe, expect, it } from "vitest";
import { HealthBuilder } from "./health.js";
import type { HealthCheck } from "./types.js";

describe("HealthBuilder", () => {
  it("returns mesh-shape snapshot with no probes (status=ok)", async () => {
    const hb = new HealthBuilder({
      version: "0.1.0",
      startedAtMs: 1_000,
      clock: () => 11_000,
    });
    const snap = await hb.snapshot();
    expect(snap).toStrictEqual({
      status: "ok",
      version: "0.1.0",
      uptime_s: 10,
      checks: [],
    });
  });

  it("status=degraded when any probe is degraded but none down", async () => {
    const probes = [
      (): HealthCheck => ({ name: "a", status: "ok" }),
      (): HealthCheck => ({ name: "b", status: "degraded" }),
    ];
    const hb = new HealthBuilder({
      version: "1",
      startedAtMs: 0,
      probes,
      clock: () => 0,
    });
    const snap = await hb.snapshot();
    expect(snap.status).toBe("degraded");
    expect(snap.checks).toStrictEqual([
      { name: "a", status: "ok" },
      { name: "b", status: "degraded" },
    ]);
  });

  it("status=down when any probe is down", async () => {
    const probes = [
      (): HealthCheck => ({ name: "ok", status: "ok" }),
      (): HealthCheck => ({ name: "x", status: "down" }),
      (): HealthCheck => ({ name: "deg", status: "degraded" }),
    ];
    const hb = new HealthBuilder({
      version: "1",
      startedAtMs: 0,
      probes,
      clock: () => 5_000,
    });
    const snap = await hb.snapshot();
    expect(snap.status).toBe("down");
    expect(snap.uptime_s).toBe(5);
  });

  it("converts a throwing probe to a down check, does not crash", async () => {
    const probes = [
      (): HealthCheck => {
        throw new Error("boom");
      },
    ];
    const hb = new HealthBuilder({
      version: "1",
      startedAtMs: 0,
      probes,
      clock: () => 0,
    });
    const snap = await hb.snapshot();
    expect(snap.status).toBe("down");
    expect(snap.checks[0]).toStrictEqual({ name: "probe_0", status: "down" });
  });

  it("treats a malformed probe return value as down", async () => {
    const probes = [
      // intentionally malformed: missing status
      (): HealthCheck => ({ name: "bad" } as unknown as HealthCheck),
    ];
    const hb = new HealthBuilder({
      version: "1",
      startedAtMs: 0,
      probes,
      clock: () => 0,
    });
    const snap = await hb.snapshot();
    expect(snap.checks[0]).toStrictEqual({ name: "probe_0", status: "down" });
    expect(snap.status).toBe("down");
  });

  it("clamps negative uptime to zero", async () => {
    const hb = new HealthBuilder({
      version: "1",
      startedAtMs: 10_000,
      clock: () => 5_000, // clock skew
    });
    const snap = await hb.snapshot();
    expect(snap.uptime_s).toBe(0);
  });
});
