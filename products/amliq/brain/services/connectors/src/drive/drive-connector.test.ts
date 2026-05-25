import { describe, expect, it, vi } from "vitest";
import { ConnectorError, type TenantContext } from "../types.js";
import { DriveConnector } from "./drive-connector.js";

const CTX: TenantContext = {
  tenant_id: "tenant-acme",
  actor_id: "user-1",
  roles: ["analyst"],
};
const BASE = "https://www.googleapis.example";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function textRes(body: string): Response {
  return new Response(body, { status: 200 });
}
function build(fakeFetch: typeof fetch): DriveConnector {
  return new DriveConnector({
    baseUrl: BASE,
    tokenForTenant: (t) => `oauth-${t}`,
    httpFetch: fakeFetch,
  });
}
/** Build a fetch impl that returns `meta` on the metadata call and
 *  `body` on the second call. */
function metaThen(meta: unknown, body: Response): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes("fields=") ? jsonRes(meta) : body,
  );
}
/** Capture URLs + headers on every fetch; respond with a stub. */
function captureFetch(
  responseBody: unknown = { files: [] },
): { fetch: typeof fetch; seen: string[]; headers: Record<string, string>[] } {
  const seen: string[] = [];
  const headers: Record<string, string>[] = [];
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(String(input));
    headers.push((init?.headers ?? {}) as Record<string, string>);
    return jsonRes(responseBody);
  });
  return { fetch: f, seen, headers };
}

describe("DriveConnector.list", () => {
  it("maps results and pagination on happy path", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonRes({
        files: [
          {
            id: "f1",
            name: "kyc.md",
            mimeType: "text/markdown",
            modifiedTime: "2026-05-25T12:00:00Z",
          },
        ],
        nextPageToken: "page-2",
      }),
    );
    const r = await build(fakeFetch).list({ text: "kyc" }, CTX);
    expect(r.items[0]).toEqual({
      uri: "drive://f1",
      title: "kyc.md",
      snippet: "text/markdown",
      updated_at: "2026-05-25T12:00:00Z",
    });
    expect(r.cursor).toBe("page-2");
  });

  it("returns null cursor when nextPageToken absent or empty", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonRes({ files: [{ id: "f1", name: "n", mimeType: "x" }] }),
    );
    const r = await build(fakeFetch).list({ text: "x" }, CTX);
    expect(r.cursor).toBeNull();
    expect(r.items[0]?.updated_at).toBe("");
    const fakeFetch2 = vi.fn(async () =>
      jsonRes({ files: [], nextPageToken: "" }),
    );
    expect((await build(fakeFetch2).list({ text: "x" }, CTX)).cursor).toBeNull();
  });

  it("uses default baseUrl when none provided", async () => {
    const c = new DriveConnector({
      tokenForTenant: () => "t",
      httpFetch: vi.fn(async () => jsonRes({ files: [] })),
    });
    expect(c.source).toBe("drive");
  });

  it("enforces tenant isolation, bearer token, quote-escaping (CRITICAL)", async () => {
    const cap = captureFetch();
    await build(cap.fetch).list({ text: "a'b" }, CTX);
    expect(cap.seen[0]).toContain("tenant_id");
    expect(cap.seen[0]).toContain("tenant-acme");
    expect(cap.seen[0]).toContain("a%5C%27b");
    expect(cap.headers[0]?.Authorization).toBe("Bearer oauth-tenant-acme");
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

  it("propagates pageToken and pageSize", async () => {
    const cap = captureFetch();
    await build(cap.fetch).list(
      { text: "x", cursor: "tok-1", limit: 10 },
      CTX,
    );
    expect(cap.seen[0]).toContain("pageToken=tok-1");
    expect(cap.seen[0]).toContain("pageSize=10");
  });
});

describe("DriveConnector.fetch", () => {
  it("fetches plain text and produces a ComplianceDoc", async () => {
    const doc = await build(
      metaThen(
        {
          id: "f1",
          name: "policy.txt",
          mimeType: "text/plain",
          modifiedTime: "2026-05-25T12:00:00Z",
        },
        textRes("hello world"),
      ),
    ).fetch("drive://f1", CTX);
    expect(doc).toMatchObject({
      source: "drive",
      jurisdiction: "internal",
      doc_id: "drive:f1",
      title: "policy.txt",
      body: "hello world",
      published_at: "2026-05-25T12:00:00Z",
    });
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exports google-doc as text/plain via /export", async () => {
    const seen: string[] = [];
    const f = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return url.includes("fields=")
        ? jsonRes({ id: "f1", name: "doc", mimeType: "application/vnd.google-apps.document" })
        : textRes("body text");
    });
    const doc = await build(f).fetch("drive://f1", CTX);
    expect(seen.some((u) => u.includes("/export"))).toBe(true);
    expect(doc.body).toBe("body text");
  });

  it("PDF + unsupported mimes return not_implemented (skeleton)", async () => {
    for (const mime of ["application/pdf", "application/octet-stream"]) {
      await expect(
        build(
          metaThen({ id: "f1", name: "x", mimeType: mime }, textRes("")),
        ).fetch("drive://f1", CTX),
      ).rejects.toMatchObject({ code: "not_implemented" });
    }
  });

  it("maps HTTP errors via mapHttpError (404/401/403/429/5xx)", async () => {
    const mk = (status: number) =>
      vi.fn(async () => new Response("", { status }));
    const cases: [number, string][] = [
      [404, "not_found"],
      [401, "unauthorized"],
      [403, "forbidden"],
      [429, "rate_limited"],
      [500, "upstream_error"],
    ];
    for (const [status, code] of cases) {
      await expect(
        build(mk(status)).fetch("drive://f1", CTX),
      ).rejects.toMatchObject({ code });
    }
  });

  it("rejects malformed URIs and missing tenant (CRITICAL)", async () => {
    await expect(build(vi.fn()).fetch("bad-uri", CTX))
      .rejects.toBeInstanceOf(ConnectorError);
    await expect(build(vi.fn()).fetch("drive://f1", {
      tenant_id: "", actor_id: "u", roles: [],
    })).rejects.toMatchObject({ code: "unauthorized" });
  });
});
