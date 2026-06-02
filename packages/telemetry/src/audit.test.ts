import { describe, expect, it } from "vitest";
import { InMemoryAuditLog, makeAuditEvent } from "./audit.js";
import type { AuditEventInput } from "./types.js";

const base: AuditEventInput = {
  actor: "user:1",
  action: "auth.token.issue",
  resource: "token:abc",
  outcome: "success",
};

describe("makeAuditEvent", () => {
  it("fills id and timestamp and defaults correlation/metadata", () => {
    const before = Date.now();
    const e = makeAuditEvent(base);
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.timestamp).toBeGreaterThanOrEqual(before);
    expect(e.traceId).toBeUndefined();
    expect(e.metadata).toEqual({});
    expect(e.actor).toBe("user:1");
  });

  it("preserves provided traceId and metadata", () => {
    const e = makeAuditEvent({ ...base, traceId: "t-1", metadata: { ip: "1.2.3.4" } });
    expect(e.traceId).toBe("t-1");
    expect(e.metadata).toEqual({ ip: "1.2.3.4" });
  });

  it("generates a unique id per call", () => {
    expect(makeAuditEvent(base).id).not.toBe(makeAuditEvent(base).id);
  });
});

describe("InMemoryAuditLog", () => {
  it("records events in order", async () => {
    const log = new InMemoryAuditLog();
    await log.record(makeAuditEvent(base));
    await log.record(makeAuditEvent({ ...base, action: "admin.role.grant" }));
    expect(log.events).toHaveLength(2);
    expect(log.query()).toHaveLength(2);
  });

  it("filters by each field and time bounds", async () => {
    const log = new InMemoryAuditLog();
    const a = makeAuditEvent({ ...base, actor: "a", action: "x", outcome: "success" });
    const b = makeAuditEvent({ ...base, actor: "b", action: "y", outcome: "denied" });
    await log.record({ ...a, timestamp: 100 });
    await log.record({ ...b, timestamp: 200 });

    expect(log.query({ actor: "a" })).toHaveLength(1);
    expect(log.query({ actor: "zzz" })).toHaveLength(0);
    expect(log.query({ action: "y" })).toHaveLength(1);
    expect(log.query({ outcome: "denied" })).toHaveLength(1);
    expect(log.query({ since: 150 })).toHaveLength(1);
    expect(log.query({ until: 150 })).toHaveLength(1);
    expect(log.query({ since: 100, until: 200 })).toHaveLength(2);
  });
});
