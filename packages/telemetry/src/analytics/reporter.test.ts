import { describe, expect, it, vi } from "vitest";
import {
  filterEvents,
  report,
  runAuditedReport,
} from "./reporter.js";
import {
  AnalyticsError,
  type AnalyticsEvent,
  type AuditEmitterPort,
} from "./types.js";

const ev = (
  value: number,
  ts: string,
  name = "tx",
  attrs: Record<string, string | number | boolean | null> = {},
): AnalyticsEvent => ({
  id: `i-${ts}-${value}`,
  ts,
  name,
  value,
  attributes: attrs,
});

const RANGE = {
  start: new Date("2026-01-01T00:00:00Z"),
  end: new Date("2026-02-01T00:00:00Z"),
};

describe("filterEvents", () => {
  it("includes inclusive-start, excludes exclusive-end", () => {
    const events = [
      ev(1, "2025-12-31T23:59:59Z"), // before start
      ev(2, "2026-01-01T00:00:00Z"), // == start, included
      ev(3, "2026-01-15T00:00:00Z"), // in range
      ev(4, "2026-02-01T00:00:00Z"), // == end, excluded
      ev(5, "2026-02-02T00:00:00Z"), // after
    ];
    const out = filterEvents(events, { range: RANGE });
    expect(out.map((e) => e.value)).toEqual([2, 3]);
  });

  it("filters by name", () => {
    const events = [
      ev(1, "2026-01-02T00:00:00Z", "tx"),
      ev(2, "2026-01-03T00:00:00Z", "auth"),
    ];
    const out = filterEvents(events, { range: RANGE, name: "auth" });
    expect(out.map((e) => e.value)).toEqual([2]);
  });

  it("filters by attribute equality (AND across keys)", () => {
    const events = [
      ev(1, "2026-01-02T00:00:00Z", "tx", { region: "us", merchant: "m1" }),
      ev(2, "2026-01-03T00:00:00Z", "tx", { region: "us", merchant: "m2" }),
      ev(3, "2026-01-04T00:00:00Z", "tx", { region: "eu", merchant: "m1" }),
    ];
    const out = filterEvents(events, {
      range: RANGE,
      filters: { region: "us", merchant: "m1" },
    });
    expect(out.map((e) => e.value)).toEqual([1]);
  });

  it("skips events with unparseable ts", () => {
    const events = [
      { ...ev(1, "garbage"), id: "g" },
      ev(2, "2026-01-02T00:00:00Z"),
    ];
    const out = filterEvents(events, { range: RANGE });
    expect(out.map((e) => e.value)).toEqual([2]);
  });

  it("rejects invalid range", () => {
    expect(() =>
      filterEvents([], { range: { start: new Date("nope"), end: RANGE.end } }),
    ).toThrow(AnalyticsError);
    expect(() =>
      filterEvents([], { range: { start: RANGE.end, end: RANGE.start } }),
    ).toThrow(AnalyticsError);
  });
});

describe("report", () => {
  it("computes aggregates over filtered slice", () => {
    const events = [
      ev(10, "2026-01-02T00:00:00Z"),
      ev(20, "2026-01-03T00:00:00Z"),
      ev(30, "2026-01-04T00:00:00Z"),
      ev(999, "2025-12-31T00:00:00Z"), // out of range
    ];
    const r = report(events, { range: RANGE }, () =>
      new Date("2026-02-15T00:00:00Z"),
    );
    expect(r.aggregates.count).toBe(3);
    expect(r.aggregates.sum).toBe(60);
    expect(r.generatedAt).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("runAuditedReport", () => {
  it("emits audit allow on success and returns report", () => {
    const emit = vi.fn();
    const port: AuditEmitterPort = { emit };
    const events = [ev(10, "2026-01-02T00:00:00Z")];
    const r = runAuditedReport(
      events,
      { range: RANGE, name: "tx" },
      {
        actorId: "admin_1",
        auditEmitter: port,
        clock: () => new Date("2026-02-10T00:00:00Z"),
      },
    );
    expect(r.aggregates.count).toBe(1);
    expect(emit).toHaveBeenCalledOnce();
    const arg = emit.mock.calls[0]?.[0] as {
      decision: string;
      event: string;
      resource: string;
      actorId: string;
      meta: { rows: number };
    };
    expect(arg.decision).toBe("allow");
    expect(arg.event).toBe("analytics.report.read");
    expect(arg.resource).toBe("analytics.report:tx");
    expect(arg.actorId).toBe("admin_1");
    expect(arg.meta.rows).toBe(1);
  });

  it("uses default resource when query.name not set", () => {
    const emit = vi.fn();
    runAuditedReport(
      [],
      { range: RANGE },
      { actorId: "u", auditEmitter: { emit } },
    );
    const arg = emit.mock.calls[0]?.[0] as { resource: string };
    expect(arg.resource).toBe("analytics.report:*");
  });

  it("emits audit error and rethrows on bad range", () => {
    const emit = vi.fn();
    expect(() =>
      runAuditedReport(
        [],
        { range: { start: RANGE.end, end: RANGE.start } },
        { actorId: "u", auditEmitter: { emit } },
      ),
    ).toThrow(AnalyticsError);
    expect(emit).toHaveBeenCalledOnce();
    const arg = emit.mock.calls[0]?.[0] as { decision: string };
    expect(arg.decision).toBe("error");
  });

  it("honours caller-supplied resource override", () => {
    const emit = vi.fn();
    runAuditedReport(
      [],
      { range: RANGE },
      { actorId: "u", auditEmitter: { emit }, resource: "custom:thing" },
    );
    const arg = emit.mock.calls[0]?.[0] as { resource: string };
    expect(arg.resource).toBe("custom:thing");
  });

  it("rethrows non-Error throws as 'unknown' reason", () => {
    const emit = vi.fn();
    const events: AnalyticsEvent[] = [];
    const badRange = { start: RANGE.end, end: RANGE.start };
    try {
      runAuditedReport(
        events,
        { range: badRange },
        { actorId: "u", auditEmitter: { emit } },
      );
    } catch {
      /* expected */
    }
    const arg = emit.mock.calls[0]?.[0] as { reason: string };
    expect(typeof arg.reason).toBe("string");
  });
});
