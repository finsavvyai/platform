import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  formatMoneyMinor,
  formatTimestamp,
  scoreColor,
} from './format.ts';

describe('formatMoneyMinor', () => {
  it.each([
    [0, 'USD', '$0.00'],
    [1, 'USD', '$0.01'],
    [99, 'USD', '$0.99'],
    [100, 'USD', '$1.00'],
    [12345, 'USD', '$123.45'],
    [123_456_789, 'USD', '$1,234,567.89'],
    [-2500, 'USD', '-$25.00'],
  ])('USD minor %s → %s', (minor, cur, expected) => {
    expect(formatMoneyMinor(minor, cur)).toBe(expected);
  });

  it('handles EUR with symbol', () => {
    expect(formatMoneyMinor(199_99, 'EUR')).toBe('€199.99');
  });

  it('handles GBP with symbol', () => {
    expect(formatMoneyMinor(50_00, 'GBP')).toBe('£50.00');
  });

  it('handles ILS with symbol', () => {
    expect(formatMoneyMinor(7_50, 'ILS')).toBe('₪7.50');
  });

  it('zero-decimal JPY: minor is full unit', () => {
    expect(formatMoneyMinor(1500, 'JPY')).toBe('¥1,500');
  });

  it('falls back to ISO code for unknown currency', () => {
    expect(formatMoneyMinor(10_00, 'XYZ')).toBe('10.00 XYZ');
  });

  it('normalises lowercase currency to upper', () => {
    expect(formatMoneyMinor(10_00, 'usd')).toBe('$10.00');
  });

  it('throws on non-integer minor (NaN)', () => {
    expect(() => formatMoneyMinor(Number.NaN, 'USD')).toThrow(TypeError);
  });

  it('throws on non-integer minor (float)', () => {
    expect(() => formatMoneyMinor(1.5, 'USD')).toThrow(TypeError);
  });

  it('throws on Infinity', () => {
    expect(() => formatMoneyMinor(Infinity, 'USD')).toThrow(TypeError);
  });
});

describe('formatTimestamp', () => {
  it('formats valid ISO-8601 to YYYY-MM-DD HH:mm UTC', () => {
    expect(formatTimestamp('2026-05-25T10:07:30Z')).toBe(
      '2026-05-25 10:07 UTC',
    );
  });

  it('pads single-digit components', () => {
    expect(formatTimestamp('2026-01-02T03:04:05Z')).toBe(
      '2026-01-02 03:04 UTC',
    );
  });

  it('returns input unchanged on invalid date', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('scoreColor', () => {
  it.each([
    [0, 'low'],
    [12, 'low'],
    [39, 'low'],
    [40, 'medium'],
    [62, 'medium'],
    [84, 'medium'],
    [85, 'high'],
    [94, 'high'],
    [100, 'high'],
  ])('score %d → %s', (score, expected) => {
    expect(scoreColor(score)).toBe(expected);
  });

  it('handles non-finite score (NaN) → low (safe default)', () => {
    expect(scoreColor(Number.NaN)).toBe('low');
  });

  it('handles negative score → low (under cutoff)', () => {
    expect(scoreColor(-10)).toBe('low');
  });

  it('handles >100 → high (clamps via natural cutoff)', () => {
    expect(scoreColor(150)).toBe('high');
  });
});

describe('actionLabel', () => {
  it.each([
    ['allow', 'Allow'],
    ['flag', 'Flag for review'],
    ['block', 'Block'],
  ] as const)('%s → %s', (action, expected) => {
    expect(actionLabel(action)).toBe(expected);
  });
});
