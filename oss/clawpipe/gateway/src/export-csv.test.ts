/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { csvEscape, csvLine } from './export-csv';

describe('csvEscape', () => {
  it('returns empty string for null and undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('passes safe values through unchanged', () => {
    expect(csvEscape('openai')).toBe('openai');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0.000123)).toBe('0.000123');
  });

  it('wraps values containing commas in quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('wraps values containing newlines in quotes', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('cr\rhere')).toBe('"cr\rhere"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles combined dangerous characters', () => {
    expect(csvEscape('a, "b", c')).toBe('"a, ""b"", c"');
  });
});

describe('csvLine', () => {
  it('joins cells with commas', () => {
    expect(csvLine(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes each cell independently', () => {
    expect(csvLine(['plain', 'has,comma', null])).toBe('plain,"has,comma",');
  });

  it('preserves numeric precision', () => {
    expect(csvLine(['openai', 'gpt-4o', 1234, 0.045678])).toBe('openai,gpt-4o,1234,0.045678');
  });
});
