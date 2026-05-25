/**
 * Pure utility to convert (snippet, citations) into a sequence of segments
 * for safe rendering in Astro. Producing the segments here (not as raw
 * HTML) means the template can wrap matched ranges in <mark> without any
 * `set:html` calls.
 *
 * Tested in highlight.test.ts.
 */
import type { Citation } from './types.js';

export interface Segment {
  readonly text: string;
  readonly highlighted: boolean;
}

const sortCitations = (
  c: readonly Citation[],
): readonly Citation[] =>
  [...c]
    .filter(
      (x) =>
        x.span_start >= 0 &&
        x.span_end > x.span_start,
    )
    .sort((a, b) => a.span_start - b.span_start);

/**
 * Split `snippet` into highlighted / un-highlighted segments by citation
 * span. Overlapping spans are merged — citation-linker on the API side
 * already de-overlaps, this is a defensive second pass for the UI.
 */
export const toSegments = (
  snippet: string,
  citations: readonly Citation[],
): readonly Segment[] => {
  if (snippet.length === 0) return [];
  const sorted = sortCitations(citations);
  if (sorted.length === 0) {
    return [{ text: snippet, highlighted: false }];
  }
  const out: Segment[] = [];
  let cursor = 0;
  for (const c of sorted) {
    const start = Math.max(c.span_start, cursor);
    const end = Math.min(c.span_end, snippet.length);
    if (start >= end) continue;
    if (start > cursor) {
      out.push({
        text: snippet.slice(cursor, start),
        highlighted: false,
      });
    }
    out.push({
      text: snippet.slice(start, end),
      highlighted: true,
    });
    cursor = end;
  }
  if (cursor < snippet.length) {
    out.push({
      text: snippet.slice(cursor),
      highlighted: false,
    });
  }
  return out;
};
