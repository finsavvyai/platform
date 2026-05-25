import { describe, expect, it, vi } from "vitest";
import { ConnectorError, type TenantContext } from "../types.js";
import { ConfluenceConnector } from "./confluence-connector.js";

const CTX: TenantContext = {
  tenant_id: "tenant-acme",
  actor_id: "user-1",
  roles: ["analyst"],
};
const BASE = "https://acme.atlassian.net";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function build(fakeFetch: typeof fetch): ConfluenceConnector {
  return new ConfluenceConnector({
    baseUrl: BASE,
    tokenForTenant: (t) => `tok-${t}`,
    httpFetch: fakeFetch,
  });
}

describe("ConfluenceConnector.list", () => {
  it("maps results on happy path", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            id: "10001",
            title: "KYC Policy",
            space: { key: "AML" },
            version: { when: "2026-05-25T12:00:00Z" },
            excerpt: "Identity <b>verification</b>",
          },
        ],
        _links: { next: "/wiki/...&cursor=pg-2" },
      }),
    );
    const r = await build(fakeFetch).list({ text: "kyc" }, CTX);
    expect(r.items).toEqual([
      {
        uri: "confluence://AML/10001",
        title: "KYC Policy",
        snippet: "Identity verification",
        updated_at: "2026-05-25T12:00:00Z",
      },
    ]);
    expect(r.cursor).toBe("pg-2");
  });

  it("returns null cursor when no next link, no space, no excerpt", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({
        results: [{ id: "1", title: "T" }],
        _links: { next: "/wiki/foo-without-cursor-param" },
      }),
    );
    const r = await build(fakeFetch).list({ text: "x" }, CTX);
    // _links.next exists but no cursor= → null
    expect(r.cursor).toBeNull();
    expect(r.items[0]).toMatchObject({
      uri: "confluence://unknown/1",
      snippet: "",
      updated_at: "",
    });
  });

  it("enforces tenant isolation, quote-escaping, Basic auth (CRITICAL)", async () => {
    const seen: string[] = [];
    const headers: Record<string, string>[] = [];
    const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(input));
      headers.push((init?.headers ?? {}) as Record<string, string>);
      return jsonResponse({ results: [] });
    });
    await build(fakeFetch).list({ text: 'a"b' }, CTX);
    expect(seen[0]).toContain("label+%3D+%22tenant-tenant-acme%22");
    expect(seen[0]).toContain("a%5C%22b");
    expect(headers[0]?.Authorization).toBe("Basic tok-tenant-acme");
  });

  it("rejects missing tenant_id (CRITICAL)", async () => {
    await expect(
      build(vi.fn()).list({ text: "x" }, {
        tenant_id: "",
        actor_id: "u",
        roles: [],
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("propagates cursor when provided", async () => {
    const seen: string[] = [];
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ results: [] });
    });
    await build(fakeFetch).list({ text: "x", cursor: "page-2", limit: 5 }, CTX);
    expect(seen[0]).toContain("cursor=page-2");
    expect(seen[0]).toContain("limit=5");
  });
});

describe("ConfluenceConnector.fetch", () => {
  it("returns a ComplianceDoc with HTML stripped", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({
        id: "10001",
        title: "KYC Policy",
        version: { createdAt: "2026-05-25T12:00:00Z" },
        body: { storage: { value: "<p>Hello <b>world</b></p>" } },
      }),
    );
    const doc = await build(fakeFetch).fetch("confluence://AML/10001", CTX);
    expect(doc).toMatchObject({
      source: "confluence",
      jurisdiction: "internal",
      doc_id: "confluence:AML:10001",
      title: "KYC Policy",
      published_at: "2026-05-25T12:00:00Z",
      body: "Hello world",
    });
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles missing version/body gracefully", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({ id: "10001", title: "T" }),
    );
    const doc = await build(fakeFetch).fetch("confluence://AML/10001", CTX);
    expect(doc.published_at).toBe("");
    expect(doc.body).toBe("");
  });

  it("maps 404 → not_found", async () => {
    const fakeFetch = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(
      build(fakeFetch).fetch("confluence://AML/10001", CTX),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("maps 401 → unauthorized, 403 → forbidden, 429 → rate_limited", async () => {
    const mk = (status: number) =>
      vi.fn(async () => new Response("", { status }));
    await expect(
      build(mk(401)).fetch("confluence://AML/x", CTX),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      build(mk(403)).fetch("confluence://AML/x", CTX),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      build(mk(429)).fetch("confluence://AML/x", CTX),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("maps other 5xx → upstream_error with status", async () => {
    const fakeFetch = vi.fn(async () => new Response("", { status: 503 }));
    await expect(
      build(fakeFetch).fetch("confluence://AML/x", CTX),
    ).rejects.toMatchObject({ code: "upstream_error", status: 503 });
  });

  it("rejects malformed confluence URIs", async () => {
    await expect(
      build(vi.fn()).fetch("not-confluence", CTX),
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it("rejects missing tenant_id on fetch (CRITICAL)", async () => {
    await expect(
      build(vi.fn()).fetch("confluence://AML/10001", {
        tenant_id: "",
        actor_id: "u",
        roles: [],
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
