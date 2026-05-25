/**
 * `JiraConnector.list` tests. `fetch()` tests live in
 * `jira-connector.fetch.test.ts` so each test file stays well under the
 * 200-line cap and the per-method blast radius is clear.
 */
import { describe, expect, it, vi } from "vitest";
import { type TenantContext } from "../types.js";
import { JiraConnector } from "./jira-connector.js";

const CTX: TenantContext = {
  tenant_id: "tenant-acme",
  actor_id: "user-1",
  roles: ["analyst"],
};
const NO_TENANT: TenantContext = { tenant_id: "", actor_id: "u", roles: [] };
const BASE = "https://acme.atlassian.net";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function build(
  fakeFetch: typeof fetch,
  authMode: "basic" | "bearer" = "basic",
): JiraConnector {
  return new JiraConnector({
    baseUrl: BASE,
    tokenForTenant: (t) => `tok-${t}`,
    authMode,
    httpFetch: fakeFetch,
  });
}

function captureFetch(
  body: unknown = { issues: [], startAt: 0, maxResults: 25, total: 0 },
) {
  const seen: string[] = [];
  const headers: Record<string, string>[] = [];
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(String(input));
    headers.push((init?.headers ?? {}) as Record<string, string>);
    return jsonRes(body);
  });
  return { fetch: f, seen, headers };
}

describe("JiraConnector.list", () => {
  it("maps issues on happy path and exposes null cursor when no more pages", async () => {
    const f = vi.fn(async () =>
      jsonRes({
        issues: [{
          id: "10001", key: "AML-42",
          fields: {
            summary: "Investigate flagged tx",
            description: "<p>review <b>case</b></p>",
            updated: "2026-05-25T12:00:00Z",
            labels: ["tenant-tenant-acme"],
            project: { key: "AML" },
          },
        }],
        startAt: 0, maxResults: 25, total: 1,
      }),
    );
    const r = await build(f).list({ text: "flagged" }, CTX);
    expect(r.items[0]).toEqual({
      uri: "jira:AML:AML-42",
      title: "Investigate flagged tx",
      snippet: "review case",
      updated_at: "2026-05-25T12:00:00Z",
    });
    expect(r.cursor).toBeNull();
  });

  it("paginates via startAt offset and propagates cursor on next request", async () => {
    const cap = captureFetch({
      issues: [
        { id: "1", key: "AML-1", fields: { summary: "s", project: { key: "AML" } } },
        { id: "2", key: "AML-2", fields: { summary: "s2", project: { key: "AML" } } },
      ],
      startAt: 0, maxResults: 2, total: 10,
    });
    const r = await build(cap.fetch).list({ text: "x", limit: 2 }, CTX);
    expect(r.cursor).toBe("2");
    expect(cap.seen[0]).toContain("maxResults=2");
    const cap2 = captureFetch({
      issues: [{ id: "3", key: "AML-3", fields: { summary: "s3", project: { key: "AML" } } }],
      startAt: 2, maxResults: 2, total: 3,
    });
    const r2 = await build(cap2.fetch).list({ text: "x", limit: 2, cursor: "2" }, CTX);
    expect(cap2.seen[0]).toContain("startAt=2");
    expect(r2.cursor).toBeNull();
  });

  it("enforces tenant label in JQL + Basic auth header (CRITICAL)", async () => {
    const cap = captureFetch();
    await build(cap.fetch).list({ text: 'a"b' }, CTX);
    const url = cap.seen[0] ?? "";
    expect(url).toContain("labels+in+%28tenant-tenant-acme%29");
    expect(url).toContain("a%5C%22b");
    expect(cap.headers[0]?.Authorization).toBe("Basic tok-tenant-acme");
  });

  it("uses Bearer scheme when authMode='bearer'", async () => {
    const cap = captureFetch();
    await build(cap.fetch, "bearer").list({ text: "x" }, CTX);
    expect(cap.headers[0]?.Authorization).toBe("Bearer tok-tenant-acme");
  });

  it("still enforces tenant scope when query.text is empty (CRITICAL)", async () => {
    const cap = captureFetch();
    await build(cap.fetch).list({ text: "" }, CTX);
    const url = cap.seen[0] ?? "";
    expect(url).not.toContain("text+%7E");
    expect(url).toContain("labels+in+%28tenant-tenant-acme%29");
  });

  it("rejects missing tenant_id (CRITICAL)", async () => {
    await expect(
      build(vi.fn()).list({ text: "x" }, NO_TENANT),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("clamps limit into [1, 100]", async () => {
    const cap1 = captureFetch();
    await build(cap1.fetch).list({ text: "x", limit: 9999 }, CTX);
    expect(cap1.seen[0]).toContain("maxResults=100");
    const cap2 = captureFetch();
    await build(cap2.fetch).list({ text: "x", limit: 0 }, CTX);
    expect(cap2.seen[0]).toContain("maxResults=1");
  });
});
