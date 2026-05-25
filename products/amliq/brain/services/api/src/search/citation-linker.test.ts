import { describe, expect, it } from "vitest";
import { linkCitations } from "./citation-linker.js";
import type { SearchAdapterHit } from "./types.js";
import type { ComplianceDoc } from "../../../retrieval/src/types.js";

const doc = (overrides: Partial<ComplianceDoc> = {}): ComplianceDoc => ({
  source: "fincen_rss",
  jurisdiction: "US",
  doc_id: "doc-1",
  title: "Advisory",
  published_at: "2026-05-25T00:00:00Z",
  sha256: "a".repeat(64),
  body: "body",
  ...overrides,
});

const hit = (overrides: Partial<SearchAdapterHit> = {}): SearchAdapterHit => ({
  doc: doc(),
  snippet: "FinCEN issued an advisory about beneficial ownership.",
  score: 0.9,
  ...overrides,
});

describe("linkCitations", () => {
  it("exact single match → one citation with correct span", () => {
    const out = linkCitations("advisory", [hit()]);
    expect(out).toHaveLength(1);
    const r = out[0]!;
    expect(r.doc_id).toBe("doc-1");
    expect(r.snippet).toBe(
      "FinCEN issued an advisory about beneficial ownership.",
    );
    expect(r.score).toBe(0.9);
    expect(r.citations).toHaveLength(1);
    const c = r.citations[0]!;
    expect(c.span_start).toBe(17);
    expect(c.span_end).toBe(25);
    expect(c.source).toBe("fincen_rss");
    expect(c.doc_id).toBe("doc-1");
    expect(r.snippet.slice(c.span_start, c.span_end)).toBe("advisory");
  });

  it("no match → empty citations array", () => {
    const out = linkCitations("zzz", [hit()]);
    expect(out[0]!.citations).toEqual([]);
  });

  it("multi-occurrence → one citation per non-overlapping match", () => {
    const out = linkCitations("the", [
      hit({ snippet: "the cat sat on the mat the end" }),
    ]);
    expect(out[0]!.citations).toHaveLength(3);
    const spans = out[0]!.citations.map((c) => [c.span_start, c.span_end]);
    expect(spans).toEqual([
      [0, 3],
      [15, 18],
      [23, 26],
    ]);
  });

  it("case-insensitive match preserves original snippet casing in spans", () => {
    const out = linkCitations("FINCEN", [
      hit({ snippet: "fincen issued FinCEN advisory" }),
    ]);
    expect(out[0]!.citations).toHaveLength(2);
    const c0 = out[0]!.citations[0]!;
    const c1 = out[0]!.citations[1]!;
    expect(out[0]!.snippet.slice(c0.span_start, c0.span_end)).toBe("fincen");
    expect(out[0]!.snippet.slice(c1.span_start, c1.span_end)).toBe("FinCEN");
  });

  it("empty query → no citations across all hits", () => {
    const out = linkCitations("", [hit(), hit({ snippet: "another" })]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.citations.length === 0)).toBe(true);
  });

  it("whitespace-only query is treated as empty", () => {
    const out = linkCitations("   \t\n  ", [hit()]);
    expect(out[0]!.citations).toEqual([]);
  });

  it("empty snippet → no citations even with non-empty query", () => {
    const out = linkCitations("advisory", [hit({ snippet: "" })]);
    expect(out[0]!.citations).toEqual([]);
  });

  it("multi-term query → citations for each distinct term", () => {
    const out = linkCitations("advisory FinCEN", [hit()]);
    const sourced = out[0]!.citations.map((c) =>
      out[0]!.snippet.slice(c.span_start, c.span_end).toLowerCase(),
    );
    expect(sourced.sort()).toEqual(["advisory", "fincen"]);
  });

  it("duplicate terms in query are deduped", () => {
    const out = linkCitations("the the the", [
      hit({ snippet: "the cat the dog" }),
    ]);
    expect(out[0]!.citations).toHaveLength(2);
  });

  it("overlapping matches → longer span wins, shorter merged in", () => {
    // Two terms where one is a prefix of the other in the snippet.
    const out = linkCitations("advis advisory", [
      hit({ snippet: "the advisory text" }),
    ]);
    // "advis" matches at 4..9, "advisory" at 4..12. After merge: 4..12.
    expect(out[0]!.citations).toHaveLength(1);
    const c = out[0]!.citations[0]!;
    expect([c.span_start, c.span_end]).toEqual([4, 12]);
  });

  it("falls back to 'unknown' source when doc.source is empty", () => {
    const out = linkCitations("x", [
      hit({ doc: doc({ source: "" }), snippet: "x" }),
    ]);
    expect(out[0]!.citations[0]!.source).toBe("unknown");
  });

  it("empty hits → empty results", () => {
    expect(linkCitations("anything", [])).toEqual([]);
  });

  it("overlap where later span extends further → merged end is extended", () => {
    // "abc" matches 0-3; "bcd" matches 1-4; merged span should be 0-4.
    const out = linkCitations("abc bcd", [hit({ snippet: "abcd" })]);
    expect(out[0]!.citations).toHaveLength(1);
    const c = out[0]!.citations[0]!;
    expect([c.span_start, c.span_end]).toEqual([0, 4]);
  });

  it("overlap where second span fully inside first keeps the longer", () => {
    // "advisory" first (8 chars), then "vis" inside it (3 chars).
    const out = linkCitations("advisory vis", [
      hit({ snippet: "the advisory text" }),
    ]);
    expect(out[0]!.citations).toHaveLength(1);
    const c = out[0]!.citations[0]!;
    expect([c.span_start, c.span_end]).toEqual([4, 12]);
  });
});
