/**
 * Retention / eviction policy for in-memory event slices.
 *
 * Pure functions over arrays — no I/O. Callers wire this to whatever store
 * they use (memory, redis, db). Two policies, applied in this order:
 *  1. age — drop anything older than `maxAgeMs` (relative to `now`).
 *  2. size — if still over `maxEvents`, drop oldest first.
 */

import type { AnalyticsEvent } from "./types.js";

export type RetentionPolicy = {
  /** Drop events with `ts` older than now - maxAgeMs. 0 / unset = no age cap. */
  readonly maxAgeMs?: number;
  /** Hard cap on retained event count. 0 / unset = no size cap. */
  readonly maxEvents?: number;
};

export type EvictionResult = {
  readonly kept: readonly AnalyticsEvent[];
  readonly evicted: readonly AnalyticsEvent[];
};

const sortByTsAsc = (
  events: readonly AnalyticsEvent[],
): AnalyticsEvent[] => {
  const arr = [...events];
  arr.sort((a, b) => {
    const ta = Date.parse(a.ts);
    const tb = Date.parse(b.ts);
    return ta - tb;
  });
  return arr;
};

/** Drop events whose ts is older than `now - maxAgeMs`. */
export const evictByAge = (
  events: readonly AnalyticsEvent[],
  maxAgeMs: number,
  now: Date = new Date(),
): EvictionResult => {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return { kept: events, evicted: [] };
  }
  const cutoff = now.getTime() - maxAgeMs;
  const kept: AnalyticsEvent[] = [];
  const evicted: AnalyticsEvent[] = [];
  for (const e of events) {
    const ts = Date.parse(e.ts);
    if (Number.isNaN(ts) || ts < cutoff) {
      evicted.push(e);
    } else {
      kept.push(e);
    }
  }
  return { kept, evicted };
};

/** If `events.length > maxEvents`, drop oldest until under cap. */
export const evictBySize = (
  events: readonly AnalyticsEvent[],
  maxEvents: number,
): EvictionResult => {
  if (!Number.isFinite(maxEvents) || maxEvents <= 0) {
    return { kept: events, evicted: [] };
  }
  if (events.length <= maxEvents) {
    return { kept: events, evicted: [] };
  }
  const sorted = sortByTsAsc(events);
  const dropCount = sorted.length - maxEvents;
  const evicted = sorted.slice(0, dropCount);
  const kept = sorted.slice(dropCount);
  return { kept, evicted };
};

/** Apply age then size policy. */
export const applyRetention = (
  events: readonly AnalyticsEvent[],
  policy: RetentionPolicy,
  now: Date = new Date(),
): EvictionResult => {
  const byAge =
    policy.maxAgeMs && policy.maxAgeMs > 0
      ? evictByAge(events, policy.maxAgeMs, now)
      : { kept: events, evicted: [] as AnalyticsEvent[] };

  const bySize =
    policy.maxEvents && policy.maxEvents > 0
      ? evictBySize(byAge.kept, policy.maxEvents)
      : { kept: byAge.kept, evicted: [] as AnalyticsEvent[] };

  return {
    kept: bySize.kept,
    evicted: [...byAge.evicted, ...bySize.evicted],
  };
};
