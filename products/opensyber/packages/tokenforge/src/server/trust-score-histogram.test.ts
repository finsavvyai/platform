import { describe, it, expect } from 'vitest';
import { TrustScoreEngine } from './trust-score.js';
import { makeSignals } from './trust-score-fixtures.js';
import type { TrustSignals } from '../shared/types.js';

const engine = new TrustScoreEngine();
const breakdown = (o: Partial<TrustSignals> = {}) => engine.computeBreakdown(makeSignals(o));
const reasons = (o: Partial<TrustSignals> = {}) => engine.getDropReasons(makeSignals(o));

describe('TrustScoreEngine — time-of-day histogram integration', () => {
  it('returns timeScore 5 when no histogram is provided', () => {
    expect(breakdown().timeScore).toBe(5);
  });

  it('returns timeScore 5 with low-data histogram (<30 requests)', () => {
    const buckets = new Array(24).fill(0);
    buckets[10] = 5;
    const b = breakdown({ activityHistogram: { buckets, totalRequests: 5 } });
    expect(b.timeScore).toBe(5);
  });

  it('returns timeScore 0 for never-seen hour with sufficient data', () => {
    const buckets = new Array(24).fill(0);
    buckets[10] = 50;
    // requestTimestamp=1000 → 1970-01-01T00:16:40Z → UTC hour 0
    const b = breakdown({
      requestTimestamp: 1000,
      activityHistogram: { buckets, totalRequests: 50 },
    });
    expect(b.timeScore).toBe(0);
  });

  it('returns timeScore 5 for a normal hour within the distribution', () => {
    const buckets = new Array(24).fill(0);
    // Even distribution across hours 9-14
    for (let h = 9; h <= 14; h++) buckets[h] = 10;
    // requestTimestamp at hour 10: 10 * 3600 = 36000
    const b = breakdown({
      requestTimestamp: 36000,
      activityHistogram: { buckets, totalRequests: 60 },
    });
    expect(b.timeScore).toBe(5);
  });

  it('adds unusual_time reason when timeScore < 5', () => {
    const buckets = new Array(24).fill(0);
    buckets[10] = 50;
    const r = reasons({
      requestTimestamp: 1000, // UTC hour 0
      activityHistogram: { buckets, totalRequests: 50 },
    });
    expect(r).toContain('unusual_time');
  });

  it('does not add unusual_time reason when timeScore is 5', () => {
    expect(reasons()).not.toContain('unusual_time');
  });

  it('deducts from total score when time is unusual', () => {
    const buckets = new Array(24).fill(0);
    buckets[10] = 50;
    // Perfect signals + unusual time → total should be < 100
    const b = breakdown({
      requestTimestamp: 1000, // UTC hour 0 — zero in histogram
      activityHistogram: { buckets, totalRequests: 50 },
    });
    expect(b.total).toBe(95); // 100 - 5 (lost all time-of-day points)
  });

  it('preserves full 100 score when histogram confirms normal usage', () => {
    const buckets = new Array(24).fill(0);
    buckets[0] = 40; // hour 0 is the user's primary hour
    // requestTimestamp=1000 → UTC hour 0
    const b = breakdown({
      requestTimestamp: 1000,
      activityHistogram: { buckets, totalRequests: 40 },
    });
    expect(b.timeScore).toBe(5);
    expect(b.total).toBe(100);
  });
});
