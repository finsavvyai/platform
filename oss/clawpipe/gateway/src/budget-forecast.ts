/**
 * End-of-month spend forecast: linear projection from MTD actuals.
 * Projection formula: forecast = mtd / daysElapsed * daysInMonth.
 * This is a linear estimate only; actual spend may vary.
 */

import type { Env } from './types';
import { getMonthToDateSpend } from './budget';

export interface EomForecast {
  mtdUsd: number;
  forecastEomUsd: number;
  daysElapsed: number;
  daysRemaining: number;
}

/** Number of days in the given UTC calendar month. */
export function daysInUtcMonth(year: number, month: number): number {
  // month is 1-based; Date(year, month, 0) gives last day of month (month-1)
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Days elapsed so far in the current UTC month (1 on the 1st, etc.). */
export function utcDaysElapsed(): number {
  const d = new Date();
  return d.getUTCDate();
}

/**
 * Compute end-of-month spend forecast for a project.
 * - If daysElapsed === 0, forecastEomUsd is 0 (no data yet).
 * - Otherwise: forecastEomUsd = mtd / daysElapsed * daysInMonth.
 */
export async function forecastEomSpend(
  env: Env,
  projectId: string,
): Promise<EomForecast> {
  const mtdUsd = await getMonthToDateSpend(env, projectId);

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const total = daysInUtcMonth(year, month);
  const daysElapsed = utcDaysElapsed();
  const daysRemaining = total - daysElapsed;

  const forecastEomUsd =
    daysElapsed === 0 ? 0 : (mtdUsd / daysElapsed) * total;

  return {
    mtdUsd: Math.round(mtdUsd * 10000) / 10000,
    forecastEomUsd: Math.round(forecastEomUsd * 10000) / 10000,
    daysElapsed,
    daysRemaining,
  };
}
