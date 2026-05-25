import { describe, expect, it } from "vitest";
import {
  aggregate,
  avg,
  count,
  max,
  min,
  percentile,
  sum,
  ZERO_AGGREGATES,
} from "./aggregator.js";
import { AnalyticsError } from "./types.js";
import type { AnalyticsEvent } from "./types.js";

const ev = (value: number, ts = "2026-01-01T00:00:00.000Z"): AnalyticsEvent => ({
  id: `i-${Math.random()}`,
  ts,
  name: "x",
  value,
  attributes: {},
});

describe("sum", () => {
  it("empty -> 0", () => expect(sum([])).toBe(0));
  it("single", () => expect(sum([5])).toBe(5));
  it("multi", () => expect(sum([1, 2, 3, 4])).toBe(10));
  it("negatives", () => expect(sum([-1, 1, -2, 2])).toBe(0));
  it("rejects NaN", () =>
    expect(() => sum([1, Number.NaN])).toThrow(AnalyticsError));
  it("rejects Infinity", () =>
    expect(() => sum([Infinity])).toThrow(AnalyticsError));
});

describe("count", () => {
  it("empty -> 0", () => expect(count([])).toBe(0));
  it("counts elements", () => expect(count([1, 1, 1])).toBe(3));
});

describe("avg", () => {
  it("empty -> 0", () => expect(avg([])).toBe(0));
  it("single", () => expect(avg([7])).toBe(7));
  it("multi", () => expect(avg([2, 4, 6])).toBe(4));
  it("all-equal", () => expect(avg([5, 5, 5, 5])).toBe(5));
});

describe("min / max", () => {
  it("min empty -> 0", () => expect(min([])).toBe(0));
  it("max empty -> 0", () => expect(max([])).toBe(0));
  it("min single", () => expect(min([7])).toBe(7));
  it("max single", () => expect(max([7])).toBe(7));
  it("min multi", () => expect(min([3, 1, 4, 1, 5, 9])).toBe(1));
  it("max multi", () => expect(max([3, 1, 4, 1, 5, 9])).toBe(9));
  it("all-equal", () => {
    expect(min([2, 2, 2])).toBe(2);
    expect(max([2, 2, 2])).toBe(2);
  });
  it("min rejects NaN", () =>
    expect(() => min([1, Number.NaN])).toThrow(AnalyticsError));
  it("max rejects NaN", () =>
    expect(() => max([1, Number.NaN])).toThrow(AnalyticsError));
});

describe("percentile (critical path — 100% required)", () => {
  it("empty -> 0", () => expect(percentile([], 50)).toBe(0));
  it("single -> value", () => expect(percentile([42], 99)).toBe(42));
  it("p0 -> min", () => expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1));
  it("p100 -> max", () => expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5));
  it("p50 odd -> middle", () =>
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3));
  it("p50 even -> interpolated", () =>
    expect(percentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 10));
  it("unsorted input is sorted internally", () =>
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3));
  it("all-equal -> that value", () =>
    expect(percentile([7, 7, 7, 7], 95)).toBe(7));
  it("linear-interp midpoint", () => {
    // [10, 20], p50 -> rank 0.5 -> 15
    expect(percentile([10, 20], 50)).toBe(15);
  });
  it("p99 on 100 values", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    // rank = 0.99 * 99 = 98.01 -> between idx 98 (=99) and 99 (=100)
    expect(percentile(values, 99)).toBeCloseTo(99.01, 10);
  });
  it("rejects out-of-range p", () => {
    expect(() => percentile([1], -1)).toThrow(AnalyticsError);
    expect(() => percentile([1], 101)).toThrow(AnalyticsError);
    expect(() => percentile([1], Number.NaN)).toThrow(AnalyticsError);
  });
  it("rejects NaN values", () =>
    expect(() => percentile([1, Number.NaN], 50)).toThrow(AnalyticsError));
});

describe("aggregate", () => {
  it("empty -> ZERO_AGGREGATES (frozen)", () => {
    expect(aggregate([])).toEqual(ZERO_AGGREGATES);
    expect(Object.isFrozen(ZERO_AGGREGATES)).toBe(true);
  });
  it("computes full record", () => {
    const events = [10, 20, 30, 40, 50].map((v) => ev(v));
    const a = aggregate(events);
    expect(a.count).toBe(5);
    expect(a.sum).toBe(150);
    expect(a.avg).toBe(30);
    expect(a.min).toBe(10);
    expect(a.max).toBe(50);
    expect(a.p50).toBe(30);
  });
  it("single event", () => {
    const a = aggregate([ev(7)]);
    expect(a).toMatchObject({
      count: 1,
      sum: 7,
      avg: 7,
      min: 7,
      max: 7,
      p50: 7,
      p95: 7,
      p99: 7,
    });
  });
  it("rejects NaN inside event values", () => {
    expect(() => aggregate([ev(Number.NaN)])).toThrow(AnalyticsError);
  });
});
