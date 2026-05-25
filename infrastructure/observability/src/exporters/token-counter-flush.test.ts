import { describe, it, expect } from "vitest";

import { startTokenCounterFlush } from "./token-counter-flush.js";
import { makeCounter, makeEmitter } from "./_test-fixtures.js";

describe("token-counter flush — happy path + lifecycle", () => {
  it("fires emitter on the scheduled interval and stops cleanly", () => {
    const counter = makeCounter({
      inputTokens: 100,
      outputTokens: 50,
      cachedCalls: 1,
      billedCalls: 2,
    });
    const { emitter, emits } = makeEmitter();
    let tick: (() => void) | null = null;
    let cancelled = false;
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "tenant_xyz",
      intervalMs: 1_000,
      schedule: (cb) => {
        tick = cb;
        return 42;
      },
      cancel: () => {
        cancelled = true;
      },
      flushOnStop: false,
    });
    expect(tick).not.toBeNull();
    tick!();
    tick!();
    expect(emits).toHaveLength(2);
    expect(emits[0]!.event).toBe("token_usage");
    expect(emits[0]!.resource).toBe("tenant_xyz");
    expect(emits[0]!.decision).toBe("metered");
    expect(emits[0]!.reason).toContain("in=100");
    expect(emits[0]!.meta).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      billedCalls: 2,
      cachedCalls: 1,
    });
    handle.stop();
    expect(cancelled).toBe(true);
  });

  it("stop() emits a final flush when flushOnStop=true (default)", () => {
    const counter = makeCounter({
      inputTokens: 10,
      outputTokens: 5,
      cachedCalls: 0,
      billedCalls: 1,
    });
    const { emitter, emits } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t1",
      schedule: () => 1,
      cancel: () => {},
    });
    handle.stop();
    expect(emits).toHaveLength(1);
  });

  it("stop() is idempotent", () => {
    const counter = makeCounter({
      inputTokens: 0,
      outputTokens: 0,
      cachedCalls: 0,
      billedCalls: 0,
    });
    const { emitter, emits } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t1",
      schedule: () => 1,
      cancel: () => {},
    });
    handle.stop();
    handle.stop();
    expect(emits).toHaveLength(1);
  });

  it("uses default setInterval/clearInterval when no schedule supplied", async () => {
    const counter = makeCounter({
      inputTokens: 7,
      outputTokens: 7,
      cachedCalls: 0,
      billedCalls: 1,
    });
    const { emitter, emits } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "real-timer",
      intervalMs: 10,
    });
    await new Promise((r) => setTimeout(r, 35));
    handle.stop();
    expect(emits.length).toBeGreaterThanOrEqual(1);
  });
});
