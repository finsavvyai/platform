/**
 * Pure aggregation functions over event arrays.
 *
 * All functions are deterministic, no I/O, and reject NaN / Infinity at input.
 * Empty arrays return zeroed aggregates rather than throwing — callers can
 * treat that as "no data" and render accordingly.
 *
 * For monetary fields the caller should pass integer minor units (e.g. cents)
 * — these functions perform standard arithmetic; there is no implicit decimal.
 */

import {
  AnalyticsError,
  ANALYTICS_ERROR_CODES,
  type Aggregates,
  type AnalyticsEvent,
} from "./types.js";

const ZERO_AGGREGATES: Aggregates = Object.freeze({
  count: 0,
  sum: 0,
  avg: 0,
  min: 0,
  max: 0,
  p50: 0,
  p95: 0,
  p99: 0,
});

const assertFinite = (values: readonly number[]): void => {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new AnalyticsError(
        ANALYTICS_ERROR_CODES.INVALID_VALUE,
        "aggregator received NaN or Infinity",
      );
    }
  }
};

export const sum = (values: readonly number[]): number => {
  assertFinite(values);
  let total = 0;
  for (const v of values) total += v;
  return total;
};

export const count = (values: readonly number[]): number => values.length;

export const avg = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
};

export const min = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  assertFinite(values);
  let best = values[0] as number;
  for (let i = 1; i < values.length; i += 1) {
    const v = values[i] as number;
    if (v < best) best = v;
  }
  return best;
};

export const max = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  assertFinite(values);
  let best = values[0] as number;
  for (let i = 1; i < values.length; i += 1) {
    const v = values[i] as number;
    if (v > best) best = v;
  }
  return best;
};

/**
 * Linear-interpolation percentile (Excel/NIST recommended type 7).
 * `p` is a percentage in [0, 100]. Returns 0 for empty input.
 *
 * Reference: https://en.wikipedia.org/wiki/Percentile#The_linear_interpolation_between_closest_ranks_method
 */
export const percentile = (values: readonly number[], p: number): number => {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new AnalyticsError(
      ANALYTICS_ERROR_CODES.INVALID_VALUE,
      "percentile p must be in [0,100]",
    );
  }
  if (values.length === 0) return 0;
  assertFinite(values);
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] as number;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] as number;
  if (lo === hi) return loVal;
  const hiVal = sorted[hi] as number;
  return loVal + (hiVal - loVal) * (rank - lo);
};

/** Aggregate a slice of events into a full Aggregates record. */
export const aggregate = (events: readonly AnalyticsEvent[]): Aggregates => {
  if (events.length === 0) return ZERO_AGGREGATES;
  const values = events.map((e) => e.value);
  assertFinite(values);
  return Object.freeze({
    count: values.length,
    sum: sum(values),
    avg: avg(values),
    min: min(values),
    max: max(values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  });
};

export { ZERO_AGGREGATES };
