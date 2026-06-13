/**
 * Tests for HttpRetrievalAdapter — the concrete RetrievalAdapter port impl
 * that talks to oss/finsavvy-rag over HTTP. All HTTP is mocked via an
 * injected `httpFetch`; no live rag service is contacted.
 */

import { describe, expect, it } from "vitest";
import {
  HttpRetrievalAdapter,
  createHttpRetrievalAdapter,
} from "./http-adapter.js";
import { RetrievalAdapterError } from "./http-types.js";
import type { ComplianceDoc, RetrievalAdapter } from "./types.js";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const doc = (overrides: Partial<ComplianceDoc> = {}): ComplianceDoc => ({
  source: "fincen_rss",
  jurisdiction: "US",
  doc_id: "doc-1",
  title: "Advisory",
  published_at: "2026-05-25T00:00:00Z",
  sha256: "a".repeat(64),
  body: "FinCEN advisory body",
  ...overrides,
});

describe("HttpRetrievalAdapter.query", () => {
  it("conforms to RetrievalAdapter (assignable to port)", () => {
    const adapter: RetrievalAdapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
    });
    expect(typeof adapter.query).toBe("function");
  });

  it("POSTs /search with query+k and maps rows to RetrievalResult", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal/",
      headers: { Authorization: "Bearer rag" },
      httpFetch: async (url, init) => {
        seen = { url: String(url), init: init as RequestInit };
        return jsonRes({
          results: [
            {
              doc_id: "d1",
              content: "body one",
              score: 0.91,
              meta: {
                source: "fincen_rss",
                jurisdiction: "US",
                title: "Advisory",
                published_at: "2026-05-25T00:00:00Z",
                sha256: "a".repeat(64),
              },
            },
          ],
        });
      },
    });

    const res = await adapter.query({ text: "advisory", topK: 3 });

    expect(seen!.url).toBe("https://rag.internal/search");
    expect(JSON.parse(String(seen!.init!.body))).toStrictEqual({
      query: "advisory",
      k: 3,
    });
    expect(seen!.init!.headers).toMatchObject({ Authorization: "Bearer rag" });
    expect(res.query.text).toBe("advisory");
    expect(typeof res.latencyMs).toBe("number");
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0]!.doc).toMatchObject({
      doc_id: "d1",
      source: "fincen_rss",
      jurisdiction: "US",
      title: "Advisory",
      body: "body one",
    });
    expect(res.hits[0]!.score).toBe(0.91);
  });

  it("defaults topK to 5 when omitted", async () => {
    let body: unknown = null;
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async (_url, init) => {
        body = JSON.parse(String((init as RequestInit).body));
        return jsonRes({ results: [] });
      },
    });
    await adapter.query({ text: "x" });
    expect(body).toStrictEqual({ query: "x", k: 5 });
  });

  it("accepts `hits` alias and JSON-string meta, fills sha fallback", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () =>
        jsonRes({
          hits: [
            {
              doc_id: "d2",
              content: "body two",
              meta: JSON.stringify({ title: "Doc 2" }),
            },
          ],
        }),
    });
    const res = await adapter.query({ text: "x" });
    expect(res.hits[0]!.doc.title).toBe("Doc 2");
    expect(res.hits[0]!.doc.sha256).toBe("0".repeat(64));
    expect(res.hits[0]!.doc.source).toBe("internal"); // unknown -> internal
    expect(res.hits[0]!.doc.jurisdiction).toBe("OTHER"); // unknown -> OTHER
    expect(res.hits[0]!.score).toBe(0); // missing score -> 0
  });

  it("carries chunk_index through to chunkIndex", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () =>
        jsonRes({ results: [{ doc_id: "d", content: "b", chunk_index: 4 }] }),
    });
    const res = await adapter.query({ text: "x" });
    expect(res.hits[0]!.chunkIndex).toBe(4);
  });

  it("filters hits by jurisdiction and source client-side", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () =>
        jsonRes({
          results: [
            { doc_id: "us", content: "a", meta: { jurisdiction: "US", source: "ofac" } },
            { doc_id: "uk", content: "b", meta: { jurisdiction: "UK", source: "fca" } },
          ],
        }),
    });
    const onlyUs = await adapter.query({ text: "x", jurisdiction: "US" });
    expect(onlyUs.hits.map((h) => h.doc.doc_id)).toEqual(["us"]);

    const onlyFca = await adapter.query({ text: "x", source: "fca" });
    expect(onlyFca.hits.map((h) => h.doc.doc_id)).toEqual(["uk"]);
  });

  it("maps non-2xx to upstream_error with status", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ error: "down" }, 502),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "upstream_error",
      status: 502,
    });
  });

  it("maps invalid JSON to bad_response", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () =>
        new Response("not json", { status: 200 }),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("rejects response missing results array", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ nope: true }),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("rejects rows missing doc_id", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ results: [{ content: "no id" }] }),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("rejects non-object rows", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ results: ["nope"] }),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("maps abort to timeout", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      timeoutMs: 5,
      httpFetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("maps generic fetch failure to network_error", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => {
        throw new Error("connection refused");
      },
    });
    await expect(adapter.query({ text: "x" })).rejects.toMatchObject({
      code: "network_error",
    });
  });
});

describe("HttpRetrievalAdapter.ingest", () => {
  it("POSTs /ingest mapping ComplianceDoc -> rag rows", async () => {
    let seen: { url: string; body: unknown } | null = null;
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async (url, init) => {
        seen = { url: String(url), body: JSON.parse(String((init as RequestInit).body)) };
        return jsonRes({ ok: true, count: 2 });
      },
    });

    const summary = await adapter.ingest([doc(), doc({ doc_id: "doc-2" })]);

    expect(seen!.url).toBe("https://rag.internal/ingest");
    expect(seen!.body).toStrictEqual([
      {
        doc_id: "doc-1",
        content: "FinCEN advisory body",
        meta: {
          source: "fincen_rss",
          jurisdiction: "US",
          title: "Advisory",
          published_at: "2026-05-25T00:00:00Z",
          sha256: "a".repeat(64),
        },
      },
      {
        doc_id: "doc-2",
        content: "FinCEN advisory body",
        meta: {
          source: "fincen_rss",
          jurisdiction: "US",
          title: "Advisory",
          published_at: "2026-05-25T00:00:00Z",
          sha256: "a".repeat(64),
        },
      },
    ]);
    expect(summary).toStrictEqual({ ok: true, count: 2 });
  });

  it("falls back to item count when server omits count", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ ok: true }),
    });
    const summary = await adapter.ingest([doc()]);
    expect(summary).toStrictEqual({ ok: true, count: 1 });
  });

  it("rejects when ingest not acknowledged (ok != true)", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ ok: false }),
    });
    await expect(adapter.ingest([doc()])).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("maps non-2xx on ingest to upstream_error", async () => {
    const adapter = new HttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ error: "x" }, 500),
    });
    await expect(adapter.ingest([doc()])).rejects.toMatchObject({
      code: "upstream_error",
      status: 500,
    });
  });
});

describe("RetrievalAdapterError", () => {
  it("createHttpRetrievalAdapter returns a working adapter", async () => {
    const adapter = createHttpRetrievalAdapter({
      baseUrl: "https://rag.internal",
      httpFetch: async () => jsonRes({ results: [] }),
    });
    const res = await adapter.query({ text: "x" });
    expect(res.hits).toEqual([]);
  });

  it("omits status when not provided", () => {
    const e = new RetrievalAdapterError("network_error", "x");
    expect(e.status).toBeUndefined();
    expect(e.code).toBe("network_error");
    expect(e.name).toBe("RetrievalAdapterError");
  });
});
