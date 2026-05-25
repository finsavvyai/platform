/**
 * `JiraConnector.fetch` tests. Separated from `jira-connector.test.ts`
 * to keep each test file under the 200-line cap.
 */
import { describe, expect, it, vi } from "vitest";
import { ConnectorError, type TenantContext } from "../types.js";
import { JiraConnector } from "./jira-connector.js";
import { JiraRateLimitedError } from "./jira-rate-limited-error.js";

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

function build(fakeFetch: typeof fetch): JiraConnector {
  return new JiraConnector({
    baseUrl: BASE,
    tokenForTenant: (t) => `tok-${t}`,
    authMode: "basic",
    httpFetch: fakeFetch,
  });
}

describe("JiraConnector.fetch", () => {
  it("returns ComplianceDoc with summary + description joined", async () => {
    const f = vi.fn(async () =>
      jsonRes({
        id: "10001", key: "AML-42",
        fields: {
          summary: "Block subject",
          description: "<p>OFAC <b>match</b></p>",
          updated: "2026-05-25T12:00:00Z",
          project: { key: "AML" },
        },
      }),
    );
    const doc = await build(f).fetch("jira:AML:AML-42", CTX);
    expect(doc).toMatchObject({
      source: "jira",
      jurisdiction: "internal",
      doc_id: "jira:AML:AML-42",
      title: "Block subject",
      published_at: "2026-05-25T12:00:00Z",
      body: "Block subject\n\nOFAC match",
    });
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles missing summary/description — title falls back to issue key", async () => {
    const f = vi.fn(async () => jsonRes({ id: "1", key: "AML-1" }));
    const doc = await build(f).fetch("jira:AML:AML-1", CTX);
    expect(doc.title).toBe("AML-1");
    expect(doc.body).toBe("");
    expect(doc.published_at).toBe("");
  });

  it("maps 404 / 401 / 403 / 5xx via error map", async () => {
    const cases: [number, string][] = [
      [404, "not_found"], [401, "unauthorized"],
      [403, "forbidden"], [503, "upstream_error"],
    ];
    for (const [s, code] of cases) {
      const f = vi.fn(async () => new Response("", { status: s }));
      await expect(
        build(f).fetch("jira:AML:AML-1", CTX),
      ).rejects.toMatchObject({ code });
    }
  });

  it("maps 429 → JiraRateLimitedError with retry_after_seconds (CRITICAL)", async () => {
    const f = vi.fn(async () =>
      new Response("", { status: 429, headers: { "Retry-After": "30" } }),
    );
    try {
      await build(f).fetch("jira:AML:AML-1", CTX);
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(JiraRateLimitedError);
      expect((e as JiraRateLimitedError).code).toBe("rate_limited");
      expect((e as JiraRateLimitedError).meta.retry_after_seconds).toBe(30);
    }
  });

  it("429 without numeric Retry-After omits retry_after_seconds", async () => {
    const cases = [
      new Response("", { status: 429, headers: { "Retry-After": "soon" } }),
      new Response("", { status: 429 }),
    ];
    for (const r of cases) {
      const f = vi.fn(async () => r.clone());
      try {
        await build(f).fetch("jira:AML:AML-1", CTX);
        throw new Error("should throw");
      } catch (e) {
        expect((e as JiraRateLimitedError).meta.retry_after_seconds).toBeUndefined();
      }
    }
  });

  it("rejects malformed jira URIs and missing tenant_id (CRITICAL)", async () => {
    await expect(
      build(vi.fn()).fetch("not-a-jira-uri", CTX),
    ).rejects.toBeInstanceOf(ConnectorError);
    await expect(
      build(vi.fn()).fetch("jira:onlyone", CTX),
    ).rejects.toMatchObject({ code: "invalid_uri" });
    await expect(
      build(vi.fn()).fetch("jira:AML:AML-1", NO_TENANT),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
