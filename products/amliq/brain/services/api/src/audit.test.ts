import { describe, expect, it, vi } from "vitest";
import { BrainAuditEmitter } from "./audit.js";
import type {
  AuditInput,
  AuditRecord,
  AuditSink,
} from "./types.js";

const fixedClock = (): Date => new Date("2026-05-25T10:00:00.000Z");

const baseInput: AuditInput = {
  actorId: "alice",
  event: "brain.ping",
  resource: "brain:ping",
  decision: "allow",
  reason: "heartbeat",
};

describe("BrainAuditEmitter", () => {
  it("emits one record to the sink on happy path (delivered=true)", async () => {
    const captured: AuditRecord[] = [];
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(captured).toHaveLength(1);
    const rec = captured[0]!;
    expect(rec.ts).toBe("2026-05-25T10:00:00.000Z");
    expect(rec.actor_id).toBe("alice");
    expect(rec.event).toBe("brain.ping");
    expect(rec.resource).toBe("brain:ping");
    expect(rec.decision).toBe("allow");
    expect(rec.reason).toBe("heartbeat");
    expect(rec.chain).toBeUndefined();
  });

  it("defaults reason to empty string when omitted", async () => {
    const captured: AuditRecord[] = [];
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    await e.emit({
      actorId: "a",
      event: "ev",
      resource: "r",
      decision: "deny",
    });
    expect(captured[0]!.reason).toBe("");
  });

  it("propagates meta to the sink record", async () => {
    const captured: AuditRecord[] = [];
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    await e.emit({ ...baseInput, meta: { blendedScore: 0.71 } });
    expect(captured[0]!.meta).toStrictEqual({ blendedScore: 0.71 });
  });

  it("falls back when primary sink throws (delivered=false, fallbackUsed=true)", async () => {
    const fallback: AuditRecord[] = [];
    const sink: AuditSink = () => {
      throw new Error("sink-down");
    };
    const fallbackSink: AuditSink = (r) => {
      fallback.push(r);
    };
    const e = new BrainAuditEmitter({
      sink,
      fallbackSink,
      clock: fixedClock,
    });
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(fallback).toHaveLength(1);
  });

  it("never throws when BOTH sink and fallback throw (delivered=false, fallbackUsed=false)", async () => {
    const sink: AuditSink = () => {
      throw new Error("primary");
    };
    const fallbackSink: AuditSink = () => {
      throw new Error("fallback");
    };
    const e = new BrainAuditEmitter({ sink, fallbackSink, clock: fixedClock });
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(false);
    expect(result.fallbackUsed).toBe(false);
    expect(result.record.event).toBe("brain.ping");
  });

  it("uses built-in fallback (console.error) when none provided and sink fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink: AuditSink = () => {
      throw new Error("x");
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("uses real Date clock when none injected", async () => {
    const captured: AuditRecord[] = [];
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const before = Date.now();
    const e = new BrainAuditEmitter({ sink });
    await e.emit(baseInput);
    const after = Date.now();
    const ts = Date.parse(captured[0]!.ts);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("default fallback swallows console.error throwing (does not propagate)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("console-dead");
    });
    const sink: AuditSink = () => {
      throw new Error("sink-dead");
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    // Even when BOTH the primary sink AND the built-in fallback's
    // console.error throw, emit() resolves without raising.
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(false);
    // fallback was invoked (not silently); whether it succeeded depends on
    // whether its internal try/catch swallowed the inner throw. The default
    // fallback swallows, so we report fallbackUsed=true.
    expect(result.fallbackUsed).toBe(true);
    errSpy.mockRestore();
  });

  it("awaits async sinks (delivered=true when promise resolves)", async () => {
    let resolved = false;
    const sink: AuditSink = async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      resolved = true;
    };
    const e = new BrainAuditEmitter({ sink, clock: fixedClock });
    const result = await e.emit(baseInput);
    expect(resolved).toBe(true);
    expect(result.delivered).toBe(true);
  });

  it("falls back when async sink rejects", async () => {
    const fallback: AuditRecord[] = [];
    const sink: AuditSink = async () => {
      throw new Error("async-fail");
    };
    const fallbackSink: AuditSink = (r) => {
      fallback.push(r);
    };
    const e = new BrainAuditEmitter({ sink, fallbackSink, clock: fixedClock });
    const result = await e.emit(baseInput);
    expect(result.delivered).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(fallback).toHaveLength(1);
  });

});
