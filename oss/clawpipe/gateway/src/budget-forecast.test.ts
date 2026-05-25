/** @vitest-environment node */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { forecastEomSpend, daysInUtcMonth, utcDaysElapsed } from './budget-forecast';
import type { Env } from './types';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function makeDB(spend: number) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async <T>(): Promise<T> =>
          ({ cost: spend } as unknown as T),
      }),
    }),
  };
}

function mkEnv(spend: number): Env {
  return { DB: makeDB(spend) as unknown as D1Database } as Env;
}

describe('daysInUtcMonth', () => {
  it('returns 31 for January', () => expect(daysInUtcMonth(2026, 1)).toBe(31));
  it('returns 28 for February 2025 (non-leap)', () => expect(daysInUtcMonth(2025, 2)).toBe(28));
  it('returns 29 for February 2024 (leap)', () => expect(daysInUtcMonth(2024, 2)).toBe(29));
  it('returns 30 for April', () => expect(daysInUtcMonth(2026, 4)).toBe(30));
});

describe('forecastEomSpend — mid-month projection', () => {
  it('projects linearly from day 15 of a 30-day month', async () => {
    // Fix time: 2026-04-15 (April = 30 days, day 15)
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    const env = mkEnv(150); // $150 spent in 15 days
    const r = await forecastEomSpend(env, 'p1');
    expect(r.daysElapsed).toBe(15);
    expect(r.daysRemaining).toBe(15);
    expect(r.mtdUsd).toBe(150);
    // 150 / 15 * 30 = 300
    expect(r.forecastEomUsd).toBe(300);
  });

  it('projects from day 10 of a 31-day month', async () => {
    // Fix time: 2026-05-10 (May = 31 days, day 10)
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'));
    const env = mkEnv(10);
    const r = await forecastEomSpend(env, 'p1');
    expect(r.daysElapsed).toBe(10);
    expect(r.daysRemaining).toBe(21);
    // 10 / 10 * 31 = 31
    expect(r.forecastEomUsd).toBe(31);
  });
});

describe('forecastEomSpend — day 1 (no extrapolation warranted)', () => {
  it('still returns a linear projection on day 1', async () => {
    vi.setSystemTime(new Date('2026-05-01T06:00:00Z'));
    const env = mkEnv(5);
    const r = await forecastEomSpend(env, 'p1');
    expect(r.daysElapsed).toBe(1);
    expect(r.daysRemaining).toBe(30);
    // 5 / 1 * 31 = 155
    expect(r.forecastEomUsd).toBe(155);
  });
});

describe('forecastEomSpend — last day (forecast ≈ mtd)', () => {
  it('forecast equals mtd on the last day of the month', async () => {
    // 2026-04-30: daysElapsed=30, total=30
    vi.setSystemTime(new Date('2026-04-30T23:00:00Z'));
    const env = mkEnv(299.99);
    const r = await forecastEomSpend(env, 'p1');
    expect(r.daysElapsed).toBe(30);
    expect(r.daysRemaining).toBe(0);
    // 299.99 / 30 * 30 = 299.99
    expect(r.forecastEomUsd).toBe(299.99);
  });
});

describe('forecastEomSpend — zero spend', () => {
  it('returns zero forecast when no spend recorded', async () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const env = mkEnv(0);
    const r = await forecastEomSpend(env, 'p1');
    expect(r.forecastEomUsd).toBe(0);
    expect(r.mtdUsd).toBe(0);
  });
});
