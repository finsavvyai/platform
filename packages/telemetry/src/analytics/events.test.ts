import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REDACTED } from "../redact.js";
import {
  AnalyticsIngestor,
  createAnalyticsIngestor,
  type EventSink,
} from "./events.js";

const fixedClock = () => new Date("2026-01-01T00:00:00.000Z");
let counter = 0;
const fixedId = () => {
  counter += 1;
  return `evt_test_${counter}`;
};

describe("AnalyticsIngestor — ingest + redaction", () => {
  beforeEach(() => {
    counter = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("happy path: assigns id+ts, calls sink, returns event", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({
      name: "transaction.amount_minor",
      value: 12500,
      attributes: { merchant_id: "m1", region: "us" },
    });
    expect(out).not.toBeNull();
    expect(out).toMatchObject({
      id: "evt_test_1",
      ts: "2026-01-01T00:00:00.000Z",
      name: "transaction.amount_minor",
      value: 12500,
      attributes: { merchant_id: "m1", region: "us" },
    });
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(out);
  });

  it("redacts secret-named attribute keys (critical path)", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({
      name: "auth.attempt",
      value: 1,
      attributes: { user: "u", api_key: "sk-ant-aaaaaaaaaaaaaaaa", ok: true },
    });
    expect(out?.attributes.api_key).toBe(REDACTED);
    expect(out?.attributes.user).toBe("u");
    expect(out?.attributes.ok).toBe(true);
  });

  it("redacts token-shaped substrings inside string attribute values", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({
      name: "audit",
      value: 0,
      attributes: { note: "leaked sk-aaaaaaaaaaaaaaaaaa in body" },
    });
    expect(out?.attributes.note as string).not.toContain(
      "sk-aaaaaaaaaaaaaaaaaa",
    );
    expect(out?.attributes.note as string).toContain(REDACTED);
  });

  it("rejects NaN value, returns null, never throws", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({ name: "x", value: Number.NaN });
    expect(out).toBeNull();
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects Infinity value", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    expect(ing.ingest({ name: "x", value: Infinity })).toBeNull();
    expect(ing.ingest({ name: "x", value: -Infinity })).toBeNull();
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects empty / non-string name", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    expect(ing.ingest({ name: "", value: 1 })).toBeNull();
    expect(
      ing.ingest({ name: 42 as unknown as string, value: 1 }),
    ).toBeNull();
    expect(sink).not.toHaveBeenCalled();
  });

  it("routes sink errors to fallback sink, still returns event", () => {
    const sink: EventSink = () => {
      throw new Error("downstream is sad");
    };
    const fallback = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      fallbackSink: fallback,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({ name: "x", value: 1 });
    expect(out).not.toBeNull();
    expect(fallback).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledWith(out);
  });

  it("swallows fallback-sink errors", () => {
    const sink: EventSink = () => {
      throw new Error("sink boom");
    };
    const fallback: EventSink = () => {
      throw new Error("fallback boom");
    };
    const ing = new AnalyticsIngestor({
      sink,
      fallbackSink: fallback,
      clock: fixedClock,
      idFactory: fixedId,
    });
    // Must not throw.
    expect(() => ing.ingest({ name: "x", value: 1 })).not.toThrow();
  });

  it("uses default console sink when none provided", () => {
    const ing = new AnalyticsIngestor({ clock: fixedClock, idFactory: fixedId });
    ing.ingest({ name: "x", value: 1 });
    expect(console.log).toHaveBeenCalledOnce();
  });

  it("coerces non-scalar attribute values to string", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const out = ing.ingest({
      name: "x",
      value: 1,
      attributes: { thing: { nested: 1 } as unknown as string, n: null },
    });
    expect(typeof out?.attributes.thing).toBe("string");
    expect(out?.attributes.n).toBeNull();
  });

  it("uses caller-supplied ts (Date and string), falls back on invalid", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    const a = ing.ingest({
      name: "x",
      value: 1,
      ts: new Date("2026-02-02T00:00:00.000Z"),
    });
    expect(a?.ts).toBe("2026-02-02T00:00:00.000Z");
    const b = ing.ingest({ name: "x", value: 1, ts: "2026-03-03T00:00:00Z" });
    expect(b?.ts).toBe("2026-03-03T00:00:00.000Z");
    const c = ing.ingest({ name: "x", value: 1, ts: "not-a-date" });
    expect(c?.ts).toBe("2026-01-01T00:00:00.000Z");
    const d = ing.ingest({ name: "x", value: 1, ts: new Date("nope") });
    expect(d?.ts).toBe("2026-01-01T00:00:00.000Z");
  });

  it("default id factory produces unique-ish ids", () => {
    const sink = vi.fn();
    const ing = new AnalyticsIngestor({ sink });
    const a = ing.ingest({ name: "x", value: 1 });
    const b = ing.ingest({ name: "x", value: 1 });
    expect(a?.id).not.toBe(b?.id);
  });

  it("factory returns an AnalyticsIngestor", () => {
    expect(createAnalyticsIngestor()).toBeInstanceOf(AnalyticsIngestor);
  });

  it("rejects invalid input with non-Error throw in default-fallback path", () => {
    // Cover the catch branch where fallbackSink throws but is swallowed via
    // default sink path — by passing a fallback that throws a string.
    const sink: EventSink = () => {
      throw "string-thrown";
    };
    const ing = new AnalyticsIngestor({
      sink,
      clock: fixedClock,
      idFactory: fixedId,
    });
    // Default fallback writes to console.error which is mocked above.
    expect(() => ing.ingest({ name: "x", value: 1 })).not.toThrow();
  });
});
