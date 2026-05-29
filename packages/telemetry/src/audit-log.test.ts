import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuditEmitter,
  type AuditRecord,
  createAuditEmitter,
} from "./audit-log.js";
import { REDACTED } from "./redact.js";

const fixedClock = () => new Date("2026-01-01T00:00:00.000Z");

describe("AuditEmitter — shape & redaction", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a record with the canonical shape", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({ sink, clock: fixedClock });
    const out = emitter.emit({
      actorId: "user_1",
      event: "auth.login",
      resource: "session:abc",
      decision: "allow",
      reason: "password ok",
    });
    expect(out).toMatchObject({
      ts: "2026-01-01T00:00:00.000Z",
      actor_id: "user_1",
      event: "auth.login",
      resource: "session:abc",
      decision: "allow",
      reason: "password ok",
    });
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(out);
  });

  it("uses default console sink when none provided", () => {
    const emitter = new AuditEmitter({ clock: fixedClock });
    emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "deny",
    });
    expect(logSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as AuditRecord;
    expect(payload.decision).toBe("deny");
  });

  it("redacts secrets in meta", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({ sink, clock: fixedClock });
    const out = emitter.emit({
      actorId: "u",
      event: "admin.rotate",
      resource: "key:1",
      decision: "allow",
      meta: { api_key: "sk-ant-aaaaaaaaaaaaaaaa", note: "ok" },
    });
    expect(out.meta?.api_key).toBe(REDACTED);
    expect(out.meta?.note).toBe("ok");
  });

  it("redacts token-shaped substrings inside reason", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({ sink, clock: fixedClock });
    const out = emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "error",
      reason: "downstream returned sk-aaaaaaaaaaaaaaaaaa unexpectedly",
    });
    expect(out.reason).not.toContain("sk-aaaaaaaaaaaaaaaaaa");
    expect(out.reason).toContain(REDACTED);
  });

  it("omits meta when not provided", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({ sink, clock: fixedClock });
    const out = emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "allow",
    });
    expect("meta" in out).toBe(false);
  });

  it("defaults reason to empty string when not provided", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({ sink, clock: fixedClock });
    const out = emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "allow",
    });
    expect(out.reason).toBe("");
  });

  it("honours custom redactKeys", () => {
    const sink = vi.fn();
    const emitter = new AuditEmitter({
      sink,
      clock: fixedClock,
      redactKeys: ["ssn"],
    });
    const out = emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "allow",
      meta: { ssn: "123-45-6789", password: "still-shown" },
    });
    expect(out.meta?.ssn).toBe(REDACTED);
    // password is not in the override list, so it leaks (caller-chosen)
    expect(out.meta?.password).toBe("still-shown");
  });

  it("factory returns an AuditEmitter", () => {
    const e = createAuditEmitter();
    expect(e).toBeInstanceOf(AuditEmitter);
  });

  it("defaults clock to new Date() when none provided", () => {
    // Exercises the `options.clock ?? (() => new Date())` default branch.
    const sink = vi.fn();
    const before = Date.now();
    const emitter = new AuditEmitter({ sink });
    const out = emitter.emit({
      actorId: "u",
      event: "e",
      resource: "r",
      decision: "allow",
    });
    const after = Date.now();
    const ts = Date.parse(out.ts);
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
