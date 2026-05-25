import { describe, expect, it } from "vitest";
import { dedupe } from "./dedupe.js";
import type { ComplianceDoc } from "./types.js";

function doc(sha: string, doc_id = sha): ComplianceDoc {
  return {
    source: "fincen-rss",
    jurisdiction: "US",
    doc_id,
    title: `t-${sha}`,
    published_at: "2026-05-01T00:00:00.000Z",
    sha256: sha,
    body: `b-${sha}`,
  };
}

describe("dedupe", () => {
  it("returns empty for empty input regardless of known set", () => {
    expect(dedupe([], new Set())).toEqual([]);
    expect(dedupe([], new Set(["a", "b"]))).toEqual([]);
  });

  it("returns all docs when none are known", () => {
    const a = doc("a");
    const b = doc("b");
    const out = dedupe([a, b], new Set());
    expect(out).toEqual([a, b]);
  });

  it("filters out docs already in the known set", () => {
    const a = doc("a");
    const b = doc("b");
    const c = doc("c");
    const out = dedupe([a, b, c], new Set(["b"]));
    expect(out).toEqual([a, c]);
  });

  it("returns empty when every doc is already known", () => {
    const a = doc("a");
    const b = doc("b");
    const out = dedupe([a, b], new Set(["a", "b"]));
    expect(out).toEqual([]);
  });

  it("collapses in-batch duplicates by sha256 (first wins)", () => {
    const a1 = doc("a", "id-1");
    const a2 = doc("a", "id-2"); // same sha, different doc_id
    const b = doc("b");
    const out = dedupe([a1, a2, b], new Set());
    expect(out).toEqual([a1, b]);
  });

  it("preserves input order", () => {
    const a = doc("a");
    const b = doc("b");
    const c = doc("c");
    const out = dedupe([c, a, b], new Set());
    expect(out.map((d) => d.sha256)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate input", () => {
    const a = doc("a");
    const b = doc("b");
    const input: readonly ComplianceDoc[] = [a, b];
    const known = new Set(["a"]);
    dedupe(input, known);
    expect(input).toEqual([a, b]);
    expect(known.size).toBe(1);
  });
});
