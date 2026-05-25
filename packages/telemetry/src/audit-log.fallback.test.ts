import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditEmitter } from "./audit-log.js";

const fixedClock = () => new Date("2026-01-01T00:00:00.000Z");

describe("AuditEmitter — fallback & error handling", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("never throws when sink throws — routes to fallback", () => {
    const fallback = vi.fn();
    const emitter = new AuditEmitter({
      sink: () => {
        throw new Error("disk full");
      },
      fallbackSink: fallback,
      clock: fixedClock,
    });
    expect(() =>
      emitter.emit({
        actorId: "u",
        event: "e",
        resource: "r",
        decision: "allow",
      }),
    ).not.toThrow();
    expect(fallback).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    const errPayload = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(errPayload.audit_sink_error).toBe(true);
    expect(errPayload.message).toBe("disk full");
  });

  it("does not throw even when fallback also throws", () => {
    const emitter = new AuditEmitter({
      sink: () => {
        throw new Error("primary fail");
      },
      fallbackSink: () => {
        throw new Error("fallback fail");
      },
      clock: fixedClock,
    });
    expect(() =>
      emitter.emit({
        actorId: "u",
        event: "e",
        resource: "r",
        decision: "deny",
      }),
    ).not.toThrow();
  });

  it("default fallback writes to console.error when default sink fails", () => {
    logSpy.mockImplementation(() => {
      throw new Error("stdout broken");
    });
    const emitter = new AuditEmitter({ clock: fixedClock });
    expect(() =>
      emitter.emit({
        actorId: "u",
        event: "e",
        resource: "r",
        decision: "allow",
      }),
    ).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });

  it("does not throw when default fallback's console.error also fails", () => {
    logSpy.mockImplementation(() => {
      throw new Error("stdout broken");
    });
    errSpy.mockImplementation(() => {
      throw new Error("stderr broken");
    });
    const emitter = new AuditEmitter({ clock: fixedClock });
    expect(() =>
      emitter.emit({
        actorId: "u",
        event: "e",
        resource: "r",
        decision: "allow",
      }),
    ).not.toThrow();
  });

  it("handles non-Error throwables from the sink", () => {
    const fallback = vi.fn();
    const emitter = new AuditEmitter({
      sink: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "string failure";
      },
      fallbackSink: fallback,
      clock: fixedClock,
    });
    emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "deny",
    });
    expect(fallback).toHaveBeenCalledOnce();
    const errPayload = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(errPayload.message).toBe("string failure");
  });
});
