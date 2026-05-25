/**
 * Activity Histogram — 24-bucket time-of-day anomaly detector.
 *
 * Tracks request counts per hour-of-day and scores how unusual the
 * current hour is relative to the user's historical pattern.
 *
 * Storage key pattern: `tf:activity:{userId}`
 */

/** 24-bucket histogram (index 0-23 = hour of day). */
export interface ActivityHistogram {
  /** Request counts per hour (index = hour 0-23). */
  buckets: number[];
  /** Sum of all buckets — avoids recomputing on every call. */
  totalRequests: number;
}

/** Storage key prefix for activity histograms. */
export const ACTIVITY_KEY_PREFIX = 'tf:activity:';

/**
 * Create an empty histogram with 24 zero-filled buckets.
 * @returns A fresh ActivityHistogram with no recorded activity.
 */
export function emptyHistogram(): ActivityHistogram {
  return { buckets: new Array(24).fill(0), totalRequests: 0 };
}

/**
 * Record a request at the given hour, returning the updated histogram.
 * Pure function — does not mutate the input.
 * @param histogram - Current histogram state.
 * @param hour - Hour of day (0-23).
 * @returns New histogram with the incremented bucket.
 */
export function recordActivity(
  histogram: ActivityHistogram,
  hour: number,
): ActivityHistogram {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const buckets = [...histogram.buckets];
  buckets[h] = (buckets[h] ?? 0) + 1;
  return { buckets, totalRequests: histogram.totalRequests + 1 };
}

/**
 * Score the current hour against the user's historical activity pattern.
 *
 * Returns 0-5 points:
 *   5 — hour is within normal range (<=1 stddev from mean)
 *   3 — hour is slightly unusual (1-2 stddev from mean)
 *   1 — hour is very unusual (>2 stddev from mean)
 *   0 — hour has zero historical requests AND histogram has >=30 total
 *
 * If totalRequests < 30, returns 5 (not enough data to penalize).
 *
 * @param histogram - The user's activity histogram.
 * @param currentHour - Current hour of day (0-23).
 * @returns Trust score contribution (0-5).
 */
export function scoreTimeOfDay(
  histogram: ActivityHistogram,
  currentHour: number,
): number {
  if (histogram.totalRequests < 30) return 5;

  const h = Math.max(0, Math.min(23, Math.floor(currentHour)));
  const count = histogram.buckets[h];

  if (count === 0) return 0;

  const { mean, stddev } = bucketStats(histogram.buckets);

  if (stddev === 0) return 5;

  const deviations = Math.abs((count ?? 0) - mean) / stddev;

  if (deviations <= 1) return 5;
  if (deviations <= 2) return 3;
  return 1;
}

/**
 * Compute mean and standard deviation of non-zero buckets.
 * @param buckets - 24-element array of request counts.
 * @returns Object with mean and stddev of non-zero buckets.
 */
function bucketStats(buckets: number[]): { mean: number; stddev: number } {
  const nonZero = buckets.filter((b) => b > 0);
  if (nonZero.length === 0) return { mean: 0, stddev: 0 };

  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance =
    nonZero.reduce((sum, b) => sum + (b - mean) ** 2, 0) / nonZero.length;

  return { mean, stddev: Math.sqrt(variance) };
}
