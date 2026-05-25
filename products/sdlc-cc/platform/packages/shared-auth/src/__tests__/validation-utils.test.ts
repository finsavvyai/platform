/**
 * Tests for utility helpers in validation.ts:
 * sanitizeInput, isStrongPassword, generateSecureRandomString,
 * formatBytes, formatDate, formatDateTime, getTimeAgo.
 */
import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  isStrongPassword,
  generateSecureRandomString,
  formatBytes,
  formatDate,
  formatDateTime,
  getTimeAgo,
} from '../validation';

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------
describe('sanitizeInput', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('removes < and > characters', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('leaves safe characters unchanged', () => {
    expect(sanitizeInput('Hello World!')).toBe('Hello World!');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeInput('   ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isStrongPassword
// ---------------------------------------------------------------------------
describe('isStrongPassword', () => {
  it('returns true for a strong password', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
  });

  it('returns false for a weak password', () => {
    expect(isStrongPassword('weak')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isStrongPassword('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateSecureRandomString
// ---------------------------------------------------------------------------
describe('generateSecureRandomString', () => {
  it('returns a string of the requested length', () => {
    expect(generateSecureRandomString(16)).toHaveLength(16);
  });

  it('returns only alphanumeric characters', () => {
    const result = generateSecureRandomString(100);
    expect(/^[A-Za-z0-9]+$/.test(result)).toBe(true);
  });

  it('returns an empty string for length 0', () => {
    expect(generateSecureRandomString(0)).toBe('');
  });

  it('returns different values on successive calls', () => {
    // Probabilistic: chance of collision is astronomically small at length 20
    expect(generateSecureRandomString(20)).not.toBe(generateSecureRandomString(20));
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------
describe('formatBytes', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats 1 KB correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats 1 MB correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats raw byte value under 1 KB', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  it('formats 1 GB correctly', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns a formatted date string from a Date object', () => {
    const result = formatDate(new Date('2024-01-15'));
    expect(result).toMatch(/January/);
    expect(result).toMatch(/2024/);
  });

  it('accepts an ISO date string', () => {
    const result = formatDate('2024-06-01');
    expect(result).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe('formatDateTime', () => {
  it('includes year and month in the result', () => {
    const result = formatDateTime(new Date('2024-01-15T10:30:00'));
    expect(result).toMatch(/2024/);
  });

  it('accepts a date string', () => {
    const result = formatDateTime('2024-06-01T14:00:00');
    expect(result).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// getTimeAgo
// ---------------------------------------------------------------------------
describe('getTimeAgo', () => {
  it('returns "just now" for a brand-new date', () => {
    expect(getTimeAgo(new Date())).toBe('just now');
  });

  it('returns plural minutes for 5 minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(date)).toBe('5 minutes ago');
  });

  it('returns singular minute form', () => {
    const date = new Date(Date.now() - 1 * 60 * 1000 - 500);
    expect(getTimeAgo(date)).toMatch(/^1 minute ago/);
  });

  it('returns plural hours for 3 hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(getTimeAgo(date)).toBe('3 hours ago');
  });

  it('returns singular hour form', () => {
    const date = new Date(Date.now() - 1 * 60 * 60 * 1000 - 500);
    expect(getTimeAgo(date)).toMatch(/^1 hour ago/);
  });

  it('returns plural days for 3 days ago', () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(date)).toBe('3 days ago');
  });

  it('returns singular day form', () => {
    const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 - 500);
    expect(getTimeAgo(date)).toMatch(/^1 day ago/);
  });

  it('falls back to formatted date for dates older than 7 days', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(date)).toMatch(/\d{4}/);
  });
});
