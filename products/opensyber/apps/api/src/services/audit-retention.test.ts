import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRetentionDays } from './audit-retention.js';

describe('audit-retention service', () => {
  describe('getRetentionDays', () => {
    it('returns 3 days for free plan', () => {
      expect(getRetentionDays('free')).toBe(3);
    });

    it('returns 7 days for personal plan', () => {
      expect(getRetentionDays('personal')).toBe(7);
    });

    it('returns 90 days for pro plan', () => {
      expect(getRetentionDays('pro')).toBe(90);
    });

    it('returns 365 days for team plan', () => {
      expect(getRetentionDays('team')).toBe(365);
    });
  });
});
