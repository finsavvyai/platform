/**
 * Citation linker.
 *
 * Pure function. Given a query string and a list of adapter hits, mark
 * citation spans inside each snippet where any whitespace-tokenised query
 * term matches (case-insensitive). Returns `SearchResult[]`.
 *
 * Critical-path rules (200-line cap, 100% coverage required):
 *   - Empty query → no citations (snippet still returned).
 *   - Empty snippet → no citations.
 *   - Multi-occurrence → every non-overlapping match emitted.
 *   - Case-insensitive matching, but spans use the snippet's original
 *     character offsets (so the caller can highlight verbatim).
 *   - Overlapping matches: longer span wins; ties broken by lower start.
 *
 * No regex against attacker-controlled strings — plain string search only.
 */
import type {
  Citation,
  SearchAdapterHit,
  SearchResult,
} from "./types.js";

const tokenise = (q: string): readonly string[] => {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // After trim(), split(/\s+/) yields only non-empty tokens.
  for (const raw of trimmed.split(/\s+/)) {
    const norm = raw.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
};

const findAll = (
  haystackLower: string,
  needle: string,
): readonly { start: number; end: number }[] => {
  // Caller guarantees non-empty needle (tokenise filters empties out).
  const out: { start: number; end: number }[] = [];
  let from = 0;
  for (;;) {
    const idx = haystackLower.indexOf(needle, from);
    if (idx < 0) return out;
    const end = idx + needle.length;
    out.push({ start: idx, end });
    // Non-overlapping: advance past this match.
    from = end;
  }
};

const resolveOverlaps = (
  spans: readonly { start: number; end: number }[],
): readonly { start: number; end: number }[] => {
  if (spans.length <= 1) return spans;
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end; // longer first when start is equal
  });
  const out: { start: number; end: number }[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(s);
      continue;
    }
    if (s.start < last.end) {
      // overlap → keep the longer span
      if (s.end > last.end) {
        out[out.length - 1] = { start: last.start, end: s.end };
      }
      continue;
    }
    out.push(s);
  }
  return out;
};

const buildCitations = (
  doc_id: string,
  source: string,
  snippet: string,
  terms: readonly string[],
): readonly Citation[] => {
  if (snippet.length === 0 || terms.length === 0) return [];
  const lower = snippet.toLowerCase();
  const raw: { start: number; end: number }[] = [];
  for (const t of terms) {
    for (const m of findAll(lower, t)) raw.push(m);
  }
  if (raw.length === 0) return [];
  const merged = resolveOverlaps(raw);
  return merged.map(
    (m): Citation => ({
      doc_id,
      span_start: m.start,
      span_end: m.end,
      source,
    }),
  );
};

const sourceOf = (hit: SearchAdapterHit): string => {
  // Prefer doc.source as the human-facing source label.
  const s = hit.doc.source;
  return typeof s === "string" && s.length > 0 ? s : "unknown";
};

/**
 * Build SearchResult[] from adapter hits, linking query-term citations
 * into each snippet. Pure function — deterministic for a given input.
 */
export const linkCitations = (
  query: string,
  hits: readonly SearchAdapterHit[],
): readonly SearchResult[] => {
  const terms = tokenise(query);
  return hits.map((h): SearchResult => {
    const citations = buildCitations(
      h.doc.doc_id,
      sourceOf(h),
      h.snippet,
      terms,
    );
    return {
      doc_id: h.doc.doc_id,
      snippet: h.snippet,
      score: h.score,
      citations,
    };
  });
};
