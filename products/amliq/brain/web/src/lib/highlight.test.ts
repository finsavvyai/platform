import { describe, expect, it } from 'vitest';
import { toSegments } from './highlight.ts';
import type { Citation } from './types.ts';

const cit = (start: number, end: number): Citation => ({
  doc_id: 'd',
  source: 's',
  span_start: start,
  span_end: end,
});

describe('toSegments', () => {
  it('returns empty when snippet is empty', () => {
    expect(toSegments('', [])).toEqual([]);
  });

  it('returns single non-highlighted segment when no citations', () => {
    expect(toSegments('hello world', [])).toEqual([
      { text: 'hello world', highlighted: false },
    ]);
  });

  it('splits around a single citation', () => {
    const s = toSegments('the advisory text', [cit(4, 12)]);
    expect(s).toEqual([
      { text: 'the ', highlighted: false },
      { text: 'advisory', highlighted: true },
      { text: ' text', highlighted: false },
    ]);
  });

  it('handles citation at start and end', () => {
    expect(toSegments('abcdef', [cit(0, 3)])).toEqual([
      { text: 'abc', highlighted: true },
      { text: 'def', highlighted: false },
    ]);
    expect(toSegments('abcdef', [cit(3, 6)])).toEqual([
      { text: 'abc', highlighted: false },
      { text: 'def', highlighted: true },
    ]);
  });

  it('handles multiple non-overlapping citations in order', () => {
    const s = toSegments('the cat the dog', [cit(0, 3), cit(8, 11)]);
    expect(s).toEqual([
      { text: 'the', highlighted: true },
      { text: ' cat ', highlighted: false },
      { text: 'the', highlighted: true },
      { text: ' dog', highlighted: false },
    ]);
  });

  it('sorts unsorted citations', () => {
    const s = toSegments('the cat the dog', [cit(8, 11), cit(0, 3)]);
    expect(s[0]).toEqual({ text: 'the', highlighted: true });
  });

  it('filters out malformed citations', () => {
    const s = toSegments('abc', [cit(-1, 2), cit(2, 1), cit(0, 1)]);
    expect(s).toEqual([
      { text: 'a', highlighted: true },
      { text: 'bc', highlighted: false },
    ]);
  });

  it('clips spans to snippet bounds', () => {
    const s = toSegments('abc', [cit(1, 99)]);
    expect(s).toEqual([
      { text: 'a', highlighted: false },
      { text: 'bc', highlighted: true },
    ]);
  });

  it('skips already-consumed spans (overlap defence)', () => {
    const s = toSegments('abcdef', [cit(0, 4), cit(2, 3)]);
    // First citation 0-4 consumes through cursor=4; second 2-3 is fully
    // before cursor → skipped, no duplicate highlight.
    expect(s).toEqual([
      { text: 'abcd', highlighted: true },
      { text: 'ef', highlighted: false },
    ]);
  });
});
