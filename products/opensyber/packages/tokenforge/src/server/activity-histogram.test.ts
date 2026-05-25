import { describe, it, expect } from 'vitest';
import {
  emptyHistogram,
  recordActivity,
  scoreTimeOfDay,
  ACTIVITY_KEY_PREFIX,
} from './activity-histogram.js';

describe('ActivityHistogram', () => {
  describe('emptyHistogram()', () => {
    it('returns 24 zero-filled buckets', () => {
      const h = emptyHistogram();
      expect(h.buckets).toHaveLength(24);
      expect(h.buckets.every((b) => b === 0)).toBe(true);
      expect(h.totalRequests).toBe(0);
    });
  });

  describe('recordActivity()', () => {
    it('increments the correct bucket', () => {
      const h = recordActivity(emptyHistogram(), 14);
      expect(h.buckets[14]).toBe(1);
      expect(h.totalRequests).toBe(1);
    });

    it('does not mutate the original histogram', () => {
      const original = emptyHistogram();
      recordActivity(original, 10);
      expect(original.buckets[10]).toBe(0);
      expect(original.totalRequests).toBe(0);
    });

    it('accumulates multiple recordings in the same bucket', () => {
      let h = emptyHistogram();
      h = recordActivity(h, 9);
      h = recordActivity(h, 9);
      h = recordActivity(h, 9);
      expect(h.buckets[9]).toBe(3);
      expect(h.totalRequests).toBe(3);
    });

    it('clamps hour to 0-23 range', () => {
      const hLow = recordActivity(emptyHistogram(), -1);
      expect(hLow.buckets[0]).toBe(1);

      const hHigh = recordActivity(emptyHistogram(), 25);
      expect(hHigh.buckets[23]).toBe(1);
    });

    it('builds a realistic multi-hour distribution', () => {
      let h = emptyHistogram();
      // Simulate business-hours user: 9-17
      for (let i = 0; i < 50; i++) {
        const hour = 9 + (i % 9); // hours 9-17
        h = recordActivity(h, hour);
      }
      expect(h.totalRequests).toBe(50);
      expect(h.buckets[9]).toBeGreaterThan(0);
      expect(h.buckets[3]).toBe(0); // no activity at 3am
    });
  });

  describe('scoreTimeOfDay()', () => {
    it('returns 5 for empty histogram (not enough data)', () => {
      expect(scoreTimeOfDay(emptyHistogram(), 14)).toBe(5);
    });

    it('returns 5 for low-data histogram (<30 requests)', () => {
      let h = emptyHistogram();
      for (let i = 0; i < 29; i++) h = recordActivity(h, 10);
      expect(h.totalRequests).toBe(29);
      expect(scoreTimeOfDay(h, 3)).toBe(5);
    });

    it('returns 5 for normal hour (within 1 stddev)', () => {
      let h = emptyHistogram();
      // Evenly distribute 60 requests across hours 9-14 (10 each)
      for (let hour = 9; hour <= 14; hour++) {
        for (let i = 0; i < 10; i++) h = recordActivity(h, hour);
      }
      // Requesting at hour 10 — right in the cluster
      expect(scoreTimeOfDay(h, 10)).toBe(5);
    });

    it('returns 0 for zero-history hour with sufficient data', () => {
      let h = emptyHistogram();
      // 40 requests all at hour 10
      for (let i = 0; i < 40; i++) h = recordActivity(h, 10);
      // Hour 3 has zero historical requests
      expect(scoreTimeOfDay(h, 3)).toBe(0);
    });

    it('returns 1 for very unusual hour (>2 stddev)', () => {
      let h = emptyHistogram();
      // Tight cluster: hours 9-16 each get 20 requests (mean=20, low stddev)
      for (let hr = 9; hr <= 16; hr++) {
        for (let i = 0; i < 20; i++) h = recordActivity(h, hr);
      }
      // Add hour 3 with 1 request — far below mean of ~20
      h = recordActivity(h, 3);
      // mean of non-zero ~ (20*8 + 1)/9 ~ 17.9, stddev ~ 6.0
      // hour 3 count=1, deviation = (17.9-1)/6.0 ~ 2.8 => >2 stddev => score 1
      expect(scoreTimeOfDay(h, 3)).toBe(1);
    });

    it('returns 3 for slightly unusual hour (1-2 stddev)', () => {
      let h = emptyHistogram();
      // hours 9-11: 20 each, hour 12: 5
      for (let hr = 9; hr <= 11; hr++) {
        for (let i = 0; i < 20; i++) h = recordActivity(h, hr);
      }
      for (let i = 0; i < 5; i++) h = recordActivity(h, 12);
      // mean of non-zero = (20+20+20+5)/4 = 16.25
      // stddev ~ 6.5
      // hour 12 count=5, deviation = (16.25-5)/6.5 ~ 1.73 => between 1 and 2 => score 3
      expect(scoreTimeOfDay(h, 12)).toBe(3);
    });

    it('returns 5 when all non-zero buckets have equal counts (stddev=0)', () => {
      let h = emptyHistogram();
      // 5 requests in each of 8 hours
      for (let hr = 8; hr <= 15; hr++) {
        for (let i = 0; i < 5; i++) h = recordActivity(h, hr);
      }
      expect(scoreTimeOfDay(h, 10)).toBe(5);
    });

    it('handles boundary at exactly 30 requests', () => {
      let h = emptyHistogram();
      for (let i = 0; i < 30; i++) h = recordActivity(h, 14);
      expect(h.totalRequests).toBe(30);
      // Now scoring matters — hour 14 has all requests, hour 3 has zero
      expect(scoreTimeOfDay(h, 3)).toBe(0);
      // Hour 14 has the only non-zero bucket => stddev=0 => score 5
      expect(scoreTimeOfDay(h, 14)).toBe(5);
    });
  });

  describe('ACTIVITY_KEY_PREFIX', () => {
    it('uses tf:activity: prefix', () => {
      expect(ACTIVITY_KEY_PREFIX).toBe('tf:activity:');
    });
  });
});
