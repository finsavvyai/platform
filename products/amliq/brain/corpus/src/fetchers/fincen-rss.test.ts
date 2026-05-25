import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fincenRss } from "./fincen-rss.js";
import type { SourceConfig } from "../types.js";

const CFG: SourceConfig = {
  source: "fincen-rss",
  jurisdiction: "US",
  url: "https://example.invalid/rss",
};

const VALID_RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>FinCEN Advisories</title>
  <item>
    <title>Advisory on synthetic identity fraud</title>
    <guid isPermaLink="false">advisory-2026-001</guid>
    <pubDate>Mon, 18 May 2026 12:00:00 GMT</pubDate>
    <description><![CDATA[Body one with <b>html</b> stripped.]]></description>
  </item>
  <item>
    <title>Alert on cross-border wire typologies</title>
    <guid>advisory-2026-002</guid>
    <pubDate>Tue, 19 May 2026 09:30:00 GMT</pubDate>
    <description>Body two plain text.</description>
  </item>
</channel></rss>`;

function mockOnce(body: string, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ok
        ? new Response(body, { status })
        : new Response("err", { status }),
    ),
  );
}

describe("fincenRss", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a well-formed RSS feed into ComplianceDoc[]", async () => {
    mockOnce(VALID_RSS);
    const { docs, errors } = await fincenRss(CFG);
    expect(errors).toEqual([]);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      source: "fincen-rss",
      jurisdiction: "US",
      doc_id: "advisory-2026-001",
      title: "Advisory on synthetic identity fraud",
      published_at: "2026-05-18T12:00:00.000Z",
    });
    expect(docs[0].body).toBe("Body one with html stripped.");
    expect(docs[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(docs[1].doc_id).toBe("advisory-2026-002");
  });

  it("produces distinct sha256 per distinct body", async () => {
    mockOnce(VALID_RSS);
    const { docs } = await fincenRss(CFG);
    expect(docs[0].sha256).not.toBe(docs[1].sha256);
  });

  it("returns structured error and no docs when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const { docs, errors } = await fincenRss(CFG);
    expect(docs).toEqual([]);
    expect(errors).toEqual([
      { source: "fincen-rss", stage: "fetch", code: "fetch_failed", message: "boom" },
    ]);
  });

  it("returns fetch_failed when HTTP status is non-2xx", async () => {
    mockOnce("not found", false, 404);
    const { docs, errors } = await fincenRss(CFG);
    expect(docs).toEqual([]);
    expect(errors[0]).toMatchObject({ stage: "fetch", code: "fetch_failed" });
    expect(errors[0].message).toContain("404");
  });

  it("returns empty_or_malformed_feed when no <item> elements found", async () => {
    mockOnce("<rss><channel></channel></rss>");
    const { docs, errors } = await fincenRss(CFG);
    expect(docs).toEqual([]);
    expect(errors).toEqual([
      {
        source: "fincen-rss",
        stage: "parse",
        code: "empty_or_malformed_feed",
        message: "no <item> elements found",
      },
    ]);
  });

  it("skips items missing required fields without throwing", async () => {
    const partial = `<rss><channel>
      <item><title>Has only title</title></item>
      <item>
        <title>Good one</title>
        <guid>g</guid>
        <pubDate>Mon, 18 May 2026 12:00:00 GMT</pubDate>
        <description>ok</description>
      </item>
    </channel></rss>`;
    mockOnce(partial);
    const { docs, errors } = await fincenRss(CFG);
    expect(docs).toHaveLength(1);
    expect(docs[0].doc_id).toBe("g");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ stage: "parse", code: "missing_field" });
  });

  it("reports bad_pubdate when pubDate is unparseable", async () => {
    const bad = `<rss><channel>
      <item>
        <title>t</title>
        <guid>g</guid>
        <pubDate>not-a-date</pubDate>
        <description>d</description>
      </item>
    </channel></rss>`;
    mockOnce(bad);
    const { docs, errors } = await fincenRss(CFG);
    expect(docs).toEqual([]);
    expect(errors[0]).toMatchObject({ stage: "parse", code: "bad_pubdate" });
  });

  it("never makes a real network call (sanity: fetch is mocked)", async () => {
    const spy = vi.fn(async () => new Response(VALID_RSS));
    vi.stubGlobal("fetch", spy);
    await fincenRss(CFG);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(CFG.url);
  });
});
