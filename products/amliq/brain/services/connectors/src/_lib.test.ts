import { describe, expect, it } from "vitest";
import {
  fetchWithTimeout,
  formatDocId,
  normalizeText,
  requireTenant,
  sha256,
} from "./_lib.js";
import { ConnectorError } from "./types.js";

describe("sha256", () => {
  it("produces 64 lowercase hex chars", () => {
    const h = sha256("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("is stable across calls (idempotent)", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
  });

  it("distinguishes whitespace differences", () => {
    expect(sha256("a b")).not.toBe(sha256("a  b"));
  });

  it("handles empty strings", () => {
    expect(sha256("")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeText", () => {
  it("returns empty for empty input", () => {
    expect(normalizeText("")).toBe("");
  });

  it("strips script and style blocks with content", () => {
    const html = "<p>hi</p><script>alert(1)</script><style>x{}</style>bye";
    expect(normalizeText(html)).toBe("hi bye");
  });

  it("unwraps CDATA without losing inner content", () => {
    expect(normalizeText("<![CDATA[hello world]]>")).toBe("hello world");
  });

  it("decodes the five named entities and numeric refs", () => {
    expect(normalizeText("&amp;&lt;&gt;&quot;&apos;")).toBe("&<>\"'");
    expect(normalizeText("&#65;&#x41;")).toBe("AA");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(normalizeText("  a\n\nb\t c  ")).toBe("a b c");
  });

  it("removes HTML comments", () => {
    expect(normalizeText("a<!-- secret -->b")).toBe("a b");
  });

  it("preserves original casing (for ComplianceDoc body)", () => {
    expect(normalizeText("Hello World")).toBe("Hello World");
  });
});

describe("formatDocId", () => {
  it("joins source + parts with colon separator", () => {
    expect(formatDocId("slack", ["C123", "1234.5678"])).toBe(
      "slack:C123:1234.5678",
    );
  });

  it("URI-encodes parts so embedded colons cannot collide", () => {
    expect(formatDocId("confluence", ["SPACE", "a:b"])).toBe(
      "confluence:SPACE:a%3Ab",
    );
  });

  it("throws ConnectorError on empty parts array", () => {
    expect(() => formatDocId("slack", [])).toThrow(ConnectorError);
  });

  it("throws ConnectorError on empty individual part", () => {
    expect(() => formatDocId("slack", ["a", ""])).toThrow(ConnectorError);
  });
});

describe("requireTenant", () => {
  it("accepts a non-empty tenant_id", () => {
    expect(() => requireTenant("slack", { tenant_id: "t1" })).not.toThrow();
  });

  it("rejects missing tenant_id with unauthorized code", () => {
    try {
      requireTenant("slack", {});
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConnectorError);
      expect((e as ConnectorError).code).toBe("unauthorized");
    }
  });

  it("rejects empty-string tenant_id", () => {
    expect(() => requireTenant("drive", { tenant_id: "" })).toThrow(
      ConnectorError,
    );
  });
});

describe("fetchWithTimeout", () => {
  it("returns the response when fetch resolves in time", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("ok", { status: 200 });
    const res = await fetchWithTimeout(
      "slack",
      "http://x",
      {},
      1000,
      fakeFetch,
    );
    expect(res.status).toBe(200);
  });

  it("maps AbortError → ConnectorError(timeout)", async () => {
    const fakeFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    await expect(
      fetchWithTimeout("slack", "http://x", {}, 5, fakeFetch),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("re-throws non-abort errors unchanged", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("network down");
    };
    await expect(
      fetchWithTimeout("slack", "http://x", {}, 1000, fakeFetch),
    ).rejects.toThrow("network down");
  });
});
