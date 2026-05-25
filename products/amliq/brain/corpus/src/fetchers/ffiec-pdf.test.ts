/**
 * FFIEC PDF fetcher — skeleton tests.
 *
 * The fetcher itself is inert until PDF extraction lands (see TODO in
 * ffiec-pdf.ts). These tests pin the *contract*: it must not throw, it
 * must surface a structured `not_implemented` error, and the URL-list
 * parser must behave correctly so future implementation has a stable
 * input shape.
 */

import { describe, expect, it } from "vitest";
import { ffiecPdf, parseHandbookList } from "./ffiec-pdf.js";
import type { SourceConfig } from "../types.js";

describe("parseHandbookList", () => {
  it("returns empty array for undefined", () => {
    expect(parseHandbookList(undefined)).toEqual([]);
  });
  it("returns empty array for empty string", () => {
    expect(parseHandbookList("")).toEqual([]);
  });
  it("splits comma-separated URLs and trims whitespace", () => {
    expect(parseHandbookList("a, b ,c")).toEqual(["a", "b", "c"]);
  });
  it("drops empty entries from trailing or duplicated commas", () => {
    expect(parseHandbookList(",a,,b,")).toEqual(["a", "b"]);
  });
});

describe("ffiecPdf fetcher", () => {
  const cfg: SourceConfig = {
    source: "ffiec-pdf",
    jurisdiction: "US",
    url: "https://example.invalid/a.pdf,https://example.invalid/b.pdf",
  };

  it("returns no docs and a structured not_implemented error (does not throw)", async () => {
    const result = await ffiecPdf(cfg);
    expect(result.docs).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      source: "ffiec-pdf",
      stage: "parse",
      code: "not_implemented",
    });
    expect(result.errors[0]?.message).toContain("2 URL(s)");
  });

  it("handles empty url list without crashing", async () => {
    const result = await ffiecPdf({ ...cfg, url: "" });
    expect(result.docs).toEqual([]);
    expect(result.errors[0]?.message).toContain("0 URL(s)");
  });
});
