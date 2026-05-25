import { describe, expect, it, vi } from "vitest";
import { emitAudit, redact } from "./audit.js";
import type { EdgeAuditEvent } from "./types.js";

describe("emitAudit", () => {
  it("no-ops when sink is undefined", () => {
    expect(() =>
      emitAudit(undefined, {
        actorId: "u",
        event: "x",
        resource: "/r",
        decision: "allow",
        reason: "ok",
      }),
    ).not.toThrow();
  });

  it("invokes sink with shaped event", () => {
    const sink = vi.fn<(e: EdgeAuditEvent) => void>();
    emitAudit(
      sink,
      {
        actorId: "u",
        event: "edge.auth",
        resource: "/v1/complete",
        decision: "deny",
        reason: "missing header",
      },
      () => 42,
    );
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0]![0]).toMatchObject({
      ts: 42,
      actorId: "u",
      event: "edge.auth",
      resource: "/v1/complete",
      decision: "deny",
      reason: "missing header",
    });
  });

  it("redacts bearer leakage in reason", () => {
    const sink = vi.fn<(e: EdgeAuditEvent) => void>();
    emitAudit(sink, {
      actorId: "u",
      event: "x",
      resource: "/r",
      decision: "deny",
      reason: "saw Bearer abc.def.ghi in header",
    });
    expect(sink.mock.calls[0]![0].reason).toContain("[redacted]");
  });

  it("defaults `now` to Date.now when omitted", () => {
    const sink = vi.fn<(e: EdgeAuditEvent) => void>();
    emitAudit(sink, {
      actorId: "u",
      event: "x",
      resource: "/r",
      decision: "allow",
      reason: "ok",
    });
    expect(sink.mock.calls[0]![0].ts).toBeGreaterThan(0);
  });
});

describe("redact", () => {
  it("redacts JWT-shaped strings", () => {
    expect(redact("token=aaaaaa.bbbbbb.cccccc")).toContain("[redacted-jwt]");
  });

  it("redacts Bearer prefixed values case-insensitively", () => {
    expect(redact("bearer Abc-123")).toContain("[redacted]");
    expect(redact("Bearer XYZ.abc.def")).toContain("[redacted]");
  });

  it("leaves benign strings alone", () => {
    expect(redact("nothing sensitive here")).toBe("nothing sensitive here");
  });
});
