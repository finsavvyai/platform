/**
 * Risk Trend Aggregator
 *
 * Computes daily, weekly, and monthly risk trends from snapshots
 * with 7-day moving average smoothing.
 */

import type { TrendDataPoint } from './risk-trend.js';

export type TrendDirection = 'improving' | 'stable' | 'degrading';
export type AggregationPeriod = 'daily' | 'weekly' | 'monthly';

export interface AggregatedTrendPoint {
  date: string;
  score: number;
  smoothedScore: number;
  trend: TrendDirection;
}

export interface TrendAggregationResult {
  period: AggregationPeriod;
  points: AggregatedTrendPoint[];
  overallTrend: TrendDirection;
  averageScore: number;
  minScore: number;
  maxScore: number;
}

const SMOOTHING_WINDOW = 7;
const TREND_THRESHOLD = 3;

/**
 * Apply 7-day moving average smoothing to scores
 */
export function applyMovingAverage(scores: number[], window = SMOOTHING_WINDOW): number[] {
  return scores.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = scores.slice(start, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return Math.round(sum / slice.length);
  });
}

/**
 * Determine trend direction by comparing a score to its predecessor
 */
function determineTrend(current: number, previous: number | null): TrendDirection {
  if (previous === null) return 'stable';
  const delta = current - previous;
  if (delta > TREND_THRESHOLD) return 'improving';
  if (delta < -TREND_THRESHOLD) return 'degrading';
  return 'stable';
}

/**
 * Group data points by week (ISO week starting Monday)
 */
function groupByWeek(points: TrendDataPoint[]): Map<string, TrendDataPoint[]> {
  const groups = new Map<string, TrendDataPoint[]>();
  for (const point of points) {
    const d = new Date(point.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0] ?? '';
    const existing = groups.get(weekStart) ?? [];
    existing.push(point);
    groups.set(weekStart, existing);
  }
  return groups;
}

/**
 * Group data points by month (YYYY-MM)
 */
function groupByMonth(points: TrendDataPoint[]): Map<string, TrendDataPoint[]> {
  const groups = new Map<string, TrendDataPoint[]>();
  for (const point of points) {
    const monthKey = point.date.substring(0, 7);
    const existing = groups.get(monthKey) ?? [];
    existing.push(point);
    groups.set(monthKey, existing);
  }
  return groups;
}

/**
 * Average combined scores for a group of data points
 */
function averageGroupScore(points: TrendDataPoint[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((a, p) => a + p.combinedScore, 0);
  return Math.round(sum / points.length);
}

/**
 * Compute overall trend from the full set of aggregated points
 */
function computeOverallTrend(points: AggregatedTrendPoint[]): TrendDirection {
  if (points.length < 2) return 'stable';
  const first = points[0]!.smoothedScore;
  const last = points[points.length - 1]!.smoothedScore;
  const delta = last - first;
  if (delta > TREND_THRESHOLD * 2) return 'improving';
  if (delta < -TREND_THRESHOLD * 2) return 'degrading';
  return 'stable';
}

/**
 * Aggregate raw trend data points into daily/weekly/monthly trends
 * with 7-day moving average smoothing
 */
export function aggregateRiskTrends(
  dataPoints: TrendDataPoint[],
  period: AggregationPeriod = 'daily',
): TrendAggregationResult {
  if (dataPoints.length === 0) {
    return { period, points: [], overallTrend: 'stable', averageScore: 0, minScore: 0, maxScore: 0 };
  }

  let groupedScores: { date: string; score: number }[];

  if (period === 'daily') {
    groupedScores = dataPoints.map((p) => ({ date: p.date, score: p.combinedScore }));
  } else if (period === 'weekly') {
    const weeks = groupByWeek(dataPoints);
    groupedScores = Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pts]) => ({ date, score: averageGroupScore(pts) }));
  } else {
    const months = groupByMonth(dataPoints);
    groupedScores = Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pts]) => ({ date, score: averageGroupScore(pts) }));
  }

  const rawScores = groupedScores.map((g) => g.score);
  const smoothed = applyMovingAverage(rawScores);

  const points: AggregatedTrendPoint[] = groupedScores.map((g, i) => ({
    date: g.date,
    score: g.score,
    smoothedScore: smoothed[i] ?? 0,
    trend: determineTrend(smoothed[i] ?? 0, i > 0 ? (smoothed[i - 1] ?? null) : null),
  }));

  const allScores = rawScores;
  const averageScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  return {
    period,
    points,
    overallTrend: computeOverallTrend(points),
    averageScore,
    minScore: Math.min(...allScores),
    maxScore: Math.max(...allScores),
  };
}
