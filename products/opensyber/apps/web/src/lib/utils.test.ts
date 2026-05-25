import { describe, it, expect, vi } from 'vitest';
import { cn, formatDate, formatRelativeTime } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges tailwind conflicts', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-06-15T10:30:00.000Z');
    expect(result).toContain('2025');
    expect(result).toContain('Jun');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date('2025-01-01T00:00:00.000Z'));
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    const result = formatRelativeTime(new Date());
    expect(result).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toBe('2h ago');
  });

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toBe('3d ago');
  });

  it('handles string dates', () => {
    const result = formatRelativeTime(new Date(Date.now() - 30 * 1000).toISOString());
    expect(result).toBe('just now');
  });
});
