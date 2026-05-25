import { describe, expect, it } from "vitest";
import { HttpSearchAdapter } from "./http-adapter.js";
import { SearchAdapterError } from "./types.js";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("HttpSearchAdapter", () => {
  it("POSTs tenant-scoped search and normalizes RAG rows", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const adapter = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      headers: { Authorization: "Bearer rag" },
      httpFetch: async (url, init) => {
        seen = { url: String(url), init };
        return jsonRes({
          results: [{
            doc_id: "d1",
            content: "FinCEN advisory body",
            score: 0.91,
            meta: {
              source: "fincen_rss",
              jurisdiction: "US",
              title: "Advisory",
              published_at: "2026-05-25T00:00:00Z",
              sha256: "a".repeat(64),
            },
          }],
        });
      },
    });

    const res = await adapter.query({ text: "advisory", tenantId: "t1", topK: 3 });
    expect(JSON.parse(String(seen!.init!.body))).toStrictEqual({
      query: "advisory",
      k: 3,
      tenant_id: "t1",
    });
    expect(seen!.init!.headers).toMatchObject({ Authorization: "Bearer rag" });
    expect(res.hits[0]!.doc).toMatchObject({
      doc_id: "d1",
      source: "fincen_rss",
      jurisdiction: "US",
      title: "Advisory",
    });
    expect(res.hits[0]!.snippet).toBe("FinCEN advisory body");
    expect(res.hits[0]!.score).toBe(0.91);
  });

  it("accepts hits alias and JSON-string meta", async () => {
    const adapter = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => jsonRes({
        hits: [{
          doc_id: "d2",
          content: "Body",
          meta: JSON.stringify({ title: "Doc 2", sha256: "b".repeat(64) }),
        }],
      }),
    });
    const res = await adapter.query({ text: "x", tenantId: "t1", topK: 1 });
    expect(res.hits[0]!.doc.title).toBe("Doc 2");
    expect(res.hits[0]!.doc.sha256).toBe("b".repeat(64));
  });

  it("maps non-2xx responses to upstream_error", async () => {
    const adapter = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => jsonRes({ error: "down" }, 502),
    });
    await expect(adapter.query({ text: "x", tenantId: "t1", topK: 1 }))
      .rejects.toMatchObject({ code: "upstream_error", status: 502 });
  });

  it("rejects malformed response shapes", async () => {
    const adapter = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => jsonRes({ results: [{}] }),
    });
    await expect(adapter.query({ text: "x", tenantId: "t1", topK: 1 }))
      .rejects.toMatchObject({ code: "bad_response" });
  });

  it("maps network failures and aborts to stable errors", async () => {
    const network = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => { throw new Error("socket"); },
    });
    await expect(network.query({ text: "x", tenantId: "t1", topK: 1 }))
      .rejects.toMatchObject({ code: "network_error" });

    const timeout = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });
    await expect(timeout.query({ text: "x", tenantId: "t1", topK: 1 }))
      .rejects.toMatchObject({ code: "timeout" });
  });

  it("throws SearchAdapterError instances", async () => {
    const adapter = new HttpSearchAdapter({
      endpoint: "https://rag.internal/search",
      httpFetch: async () => jsonRes("bad"),
    });
    await expect(adapter.query({ text: "x", tenantId: "t1", topK: 1 }))
      .rejects.toBeInstanceOf(SearchAdapterError);
  });
});
