import { describe, it, expect } from 'vitest';
import { parseCursor, buildNextCursor, parseLimit, parseDateRange } from './pagination.js';

describe('parseCursor', () => {
  it('returns null for undefined cursor', () => {
    expect(parseCursor(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCursor('')).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(parseCursor('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 but invalid JSON', () => {
    expect(parseCursor(btoa('not json'))).toBeNull();
  });

  it('returns null for JSON without required fields', () => {
    expect(parseCursor(btoa(JSON.stringify({ foo: 'bar' })))).toBeNull();
  });

  it('decodes a valid cursor', () => {
    const cursor = btoa(JSON.stringify({ createdAt: '2026-01-01', id: 'abc' }));
    const result = parseCursor(cursor);
    expect(result).toEqual({ createdAt: '2026-01-01', id: 'abc' });
  });
});

describe('buildNextCursor', () => {
  it('builds a base64 cursor string', () => {
    const cursor = buildNextCursor('2026-01-01', 'abc');
    expect(typeof cursor).toBe('string');
    const decoded = JSON.parse(atob(cursor));
    expect(decoded).toEqual({ createdAt: '2026-01-01', id: 'abc' });
  });

  it('round-trips with parseCursor', () => {
    const cursor = buildNextCursor('2026-02-15T10:30:00Z', 'test_id_123');
    const parsed = parseCursor(cursor);
    expect(parsed).toEqual({ createdAt: '2026-02-15T10:30:00Z', id: 'test_id_123' });
  });
});

describe('parseLimit', () => {
  it('returns default for undefined', () => {
    expect(parseLimit(undefined)).toBe(50);
  });

  it('returns default for non-numeric string', () => {
    expect(parseLimit('abc')).toBe(50);
  });

  it('returns default for zero', () => {
    expect(parseLimit('0')).toBe(50);
  });

  it('returns default for negative', () => {
    expect(parseLimit('-5')).toBe(50);
  });

  it('caps at max limit (200)', () => {
    expect(parseLimit('500')).toBe(200);
  });

  it('returns valid limit within range', () => {
    expect(parseLimit('25')).toBe(25);
  });
});

describe('parseDateRange', () => {
  it('returns null for undefined dates', () => {
    expect(parseDateRange(undefined, undefined)).toEqual({ from: null, to: null });
  });

  it('returns null for invalid dates', () => {
    expect(parseDateRange('not-a-date', 'also-invalid')).toEqual({ from: null, to: null });
  });

  it('parses valid ISO dates', () => {
    const result = parseDateRange('2026-01-01', '2026-12-31');
    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe('2026-12-31');
  });

  it('parses partial dates', () => {
    const result = parseDateRange('2026-01-01', undefined);
    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBeNull();
  });
});
