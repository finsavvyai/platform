import { describe, it, expect } from 'vitest';
import { formatDuration, formatFrequency, formatRate, formatRelative } from './enterprise-format';

describe('formatDuration', () => {
  it('returns em dash for null', () => expect(formatDuration(null)).toBe('—'));
  it('formats sub-second ms', () => expect(formatDuration(420)).toBe('420 ms'));
  it('formats seconds', () => expect(formatDuration(5_000)).toBe('5s'));
  it('formats minutes', () => expect(formatDuration(125_000)).toBe('2m 5s'));
  it('formats hours', () => expect(formatDuration(3_660_000)).toBe('1h 1m'));
});

describe('formatFrequency', () => {
  it('shows per-week for fractional days', () =>
    expect(formatFrequency(0.1)).toBe('0.7 / week'));
  it('shows per-day for >=1', () => expect(formatFrequency(2.4)).toBe('2.4 / day'));
  it('shows zero for non-positive', () => expect(formatFrequency(0)).toBe('0 / day'));
});

describe('formatRate', () => {
  it('returns em dash for null', () => expect(formatRate(null)).toBe('—'));
  it('formats percentage', () => expect(formatRate(0.042)).toBe('4.2%'));
});

describe('formatRelative', () => {
  it('returns em dash for null', () => expect(formatRelative(null)).toBe('—'));
  it('returns em dash for garbage', () => expect(formatRelative('not-a-date')).toBe('—'));
});
