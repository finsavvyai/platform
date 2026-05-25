/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { progressColor, scoreColor, severityColors } from './dashboard-types';

describe('Dashboard page helpers', () => {
  describe('progressColor', () => {
    it('returns red for >= 90', () => {
      expect(progressColor(95)).toBe('bg-alert');
    });
    it('returns orange for >= 70', () => {
      expect(progressColor(75)).toBe('bg-warn');
    });
    it('returns teal for < 70', () => {
      expect(progressColor(50)).toBe('bg-signal');
    });
  });

  describe('scoreColor', () => {
    it('returns green for >= 80', () => {
      expect(scoreColor(85)).toBe('text-ok');
    });
    it('returns orange for 40-79', () => {
      expect(scoreColor(60)).toBe('text-warn');
    });
    it('returns red for < 40', () => {
      expect(scoreColor(20)).toBe('text-alert');
    });
  });

  describe('severityColors', () => {
    it('has info, warning, and critical keys', () => {
      expect(severityColors.info).toBeDefined();
      expect(severityColors.warning).toBeDefined();
      expect(severityColors.critical).toBeDefined();
    });
  });
});
