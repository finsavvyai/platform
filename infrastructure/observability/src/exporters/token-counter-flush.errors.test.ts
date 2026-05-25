import { describe, it, expect } from "vitest";

import { startTokenCounterFlush } from "./token-counter-flush.js";
import { makeCounter, makeEmitter } from "./_test-fixtures.js";
import type { AuditEmitterPort, TokenCounterPort } from "../types.js";

describe("token-counter flush — error containment", () => {
  it("emitter throwing does not crash the loop", () => {
    const counter = makeCounter({
      inputTokens: 1,
      outputTokens: 1,
      cachedCalls: 0,
      billedCalls: 1,
    });
    const emitter: AuditEmitterPort = {
      emit: () => {
        throw new Error("sink dead");
      },
    };
    let tick: (() => void) | null = null;
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t",
      schedule: (cb) => {
        tick = cb;
        return 1;
      },
      cancel: () => {},
      flushOnStop: false,
    });
    expect(() => tick!()).not.toThrow();
    handle.stop();
  });

  it("counter.snapshot() throwing returns null without emitting", () => {
    const counter: TokenCounterPort = {
      snapshot: () => {
        throw new Error("counter broken");
      },
    };
    const { emitter, emits } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t",
      schedule: () => 1,
      cancel: () => {},
      flushOnStop: false,
    });
    expect(handle.flushNow()).toBeNull();
    expect(emits).toHaveLength(0);
    handle.stop();
  });

  it("resetOnFlush calls counter.reset()", () => {
    const counter = makeCounter({
      inputTokens: 3,
      outputTokens: 3,
      cachedCalls: 0,
      billedCalls: 1,
    });
    const { emitter } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t",
      resetOnFlush: true,
      schedule: () => 1,
      cancel: () => {},
      flushOnStop: false,
    });
    handle.flushNow();
    expect(counter.resets).toBe(1);
    handle.stop();
  });

  it("cancel throwing does not crash stop()", () => {
    const counter = makeCounter({
      inputTokens: 0,
      outputTokens: 0,
      cachedCalls: 0,
      billedCalls: 0,
    });
    const { emitter } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t",
      schedule: () => 1,
      cancel: () => {
        throw new Error("cancel dead");
      },
      flushOnStop: false,
    });
    expect(() => handle.stop()).not.toThrow();
  });

  it("counter.reset throwing during flush is swallowed", () => {
    const counter: TokenCounterPort = {
      snapshot: () => ({
        inputTokens: 1,
        outputTokens: 1,
        cachedCalls: 0,
        billedCalls: 1,
      }),
      reset: () => {
        throw new Error("reset dead");
      },
    };
    const { emitter, emits } = makeEmitter();
    const handle = startTokenCounterFlush({
      counter,
      emitter,
      tenantId: "t",
      resetOnFlush: true,
      schedule: () => 1,
      cancel: () => {},
      flushOnStop: false,
    });
    expect(() => handle.flushNow()).not.toThrow();
    expect(emits).toHaveLength(1);
    handle.stop();
  });
});
