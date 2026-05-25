import { describe, expect, it } from "vitest";
import {
  applyRetention,
  evictByAge,
  evictBySize,
} from "./retention.js";
import type { AnalyticsEvent } from "./types.js";

const ev = (ts: string, id = ts): AnalyticsEvent => ({
  id,
  ts,
  name: "x",
  value: 1,
  attributes: {},
});

const NOW = new Date("2026-05-01T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("evictByAge", () => {
  it("no maxAgeMs -> kept untouched", () => {
    const events = [ev("2025-01-01T00:00:00Z")];
    const r = evictByAge(events, 0, NOW);
    expect(r.kept).toBe(events);
    expect(r.evicted).toEqual([]);
  });

  it("drops events older than cutoff", () => {
    const events = [
      ev("2026-04-15T00:00:00Z"), // 16 days old
      ev("2026-04-29T00:00:00Z"), // 2 days old
      ev("2026-04-30T12:00:00Z"), // 12h old
    ];
    const r = evictByAge(events, 7 * DAY, NOW);
    expect(r.kept.map((e) => e.id)).toEqual([
      "2026-04-29T00:00:00Z",
      "2026-04-30T12:00:00Z",
    ]);
    expect(r.evicted.map((e) => e.id)).toEqual(["2026-04-15T00:00:00Z"]);
  });

  it("treats unparseable ts as evictable", () => {
    const events = [{ ...ev("garbage"), id: "g" }, ev("2026-04-30T00:00:00Z")];
    const r = evictByAge(events, DAY, NOW);
    expect(r.kept.map((e) => e.id)).toEqual(["2026-04-30T00:00:00Z"]);
    expect(r.evicted.map((e) => e.id)).toEqual(["g"]);
  });

  it("negative maxAgeMs is a no-op", () => {
    const events = [ev("2026-04-30T00:00:00Z")];
    const r = evictByAge(events, -1, NOW);
    expect(r.kept).toBe(events);
  });
});

describe("evictBySize", () => {
  it("under cap -> kept untouched", () => {
    const events = [ev("2026-01-01T00:00:00Z"), ev("2026-01-02T00:00:00Z")];
    const r = evictBySize(events, 5);
    expect(r.kept).toBe(events);
    expect(r.evicted).toEqual([]);
  });

  it("over cap -> drops oldest first", () => {
    const events = [
      ev("2026-01-03T00:00:00Z", "c"),
      ev("2026-01-01T00:00:00Z", "a"),
      ev("2026-01-02T00:00:00Z", "b"),
      ev("2026-01-04T00:00:00Z", "d"),
    ];
    const r = evictBySize(events, 2);
    expect(r.kept.map((e) => e.id)).toEqual(["c", "d"]);
    expect(r.evicted.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("maxEvents=0 -> no-op", () => {
    const events = [ev("2026-01-01T00:00:00Z")];
    const r = evictBySize(events, 0);
    expect(r.kept).toBe(events);
  });

  it("non-finite maxEvents -> no-op", () => {
    const events = [ev("2026-01-01T00:00:00Z")];
    const r = evictBySize(events, Number.NaN);
    expect(r.kept).toBe(events);
  });
});

describe("applyRetention", () => {
  it("applies age then size", () => {
    const events = [
      ev("2026-04-01T00:00:00Z", "old1"), // ~30d old — age-evict
      ev("2026-04-25T00:00:00Z", "a"), // ~6d old — keep through age
      ev("2026-04-26T00:00:00Z", "b"),
      ev("2026-04-27T00:00:00Z", "c"),
      ev("2026-04-28T00:00:00Z", "d"),
    ];
    const r = applyRetention(
      events,
      { maxAgeMs: 14 * DAY, maxEvents: 2 },
      NOW,
    );
    // After age: [a,b,c,d]. After size=2: drop oldest two -> keep c,d.
    expect(r.kept.map((e) => e.id)).toEqual(["c", "d"]);
    expect(r.evicted.map((e) => e.id).sort()).toEqual(["a", "b", "old1"]);
  });

  it("no policy keys -> no-op", () => {
    const events = [ev("2026-01-01T00:00:00Z")];
    const r = applyRetention(events, {}, NOW);
    expect(r.kept).toBe(events);
    expect(r.evicted).toEqual([]);
  });

  it("only age cap", () => {
    const events = [
      ev("2026-01-01T00:00:00Z", "old"),
      ev("2026-04-30T00:00:00Z", "fresh"),
    ];
    const r = applyRetention(events, { maxAgeMs: 7 * DAY }, NOW);
    expect(r.kept.map((e) => e.id)).toEqual(["fresh"]);
  });

  it("only size cap", () => {
    const events = [
      ev("2026-04-29T00:00:00Z", "a"),
      ev("2026-04-30T00:00:00Z", "b"),
    ];
    const r = applyRetention(events, { maxEvents: 1 }, NOW);
    expect(r.kept.map((e) => e.id)).toEqual(["b"]);
  });
});
