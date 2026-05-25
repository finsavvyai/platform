/**
 * `TeamsConnector.fetch` tests. Separated from `teams-connector.test.ts`
 * to keep each test file under the 200-line cap.
 */
import { describe, expect, it, vi } from "vitest";
import { ConnectorError, type TenantContext } from "../types.js";
import { TeamsConnector } from "./teams-connector.js";
import { TeamsRateLimitedError } from "./teams-rate-limited-error.js";

const CTX: TenantContext = {
  tenant_id: "tenant-acme",
  actor_id: "user-1",
  roles: ["analyst"],
};
const NO_TENANT: TenantContext = { tenant_id: "", actor_id: "u", roles: [] };
const BASE = "https://graph.example";
const TEAM_ID = "team-acme-1";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function build(fakeFetch: typeof fetch): TeamsConnector {
  return new TeamsConnector({
    baseUrl: BASE,
    tokenForTenant: (t) => `bearer-${t}`,
    teamIdForTenant: () => TEAM_ID,
    httpFetch: fakeFetch,
  });
}

const URI = `teams:${TEAM_ID}:ch-1:msg-1`;

describe("TeamsConnector.fetch", () => {
  it("returns a ComplianceDoc with HTML stripped", async () => {
    const f = vi.fn(async () =>
      jsonRes({
        id: "msg-1",
        subject: "AML Update",
        body: { content: "<p>SAR <b>filed</b></p>" },
        lastModifiedDateTime: "2026-05-25T12:00:00Z",
        channelIdentity: { teamId: TEAM_ID, channelId: "ch-1" },
      }),
    );
    const doc = await build(f).fetch(URI, CTX);
    expect(doc).toMatchObject({
      source: "teams",
      jurisdiction: "internal",
      doc_id: URI,
      title: "AML Update",
      body: "SAR filed",
      published_at: "2026-05-25T12:00:00Z",
    });
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives title from body when subject is missing/null", async () => {
    const f = vi.fn(async () =>
      jsonRes({ id: "msg-1", subject: null, body: { content: "hello world" } }),
    );
    const doc = await build(f).fetch(URI, CTX);
    expect(doc.title).toBe("hello world");
  });

  it("falls back to placeholder title when body normalises to empty", async () => {
    const f = vi.fn(async () => jsonRes({ id: "msg-1", body: { content: "" } }));
    const doc = await build(f).fetch(URI, CTX);
    expect(doc.title).toBe("teams message msg-1");
  });

  it("maps 404 / 401 / 403 / 5xx via error map", async () => {
    const cases: [number, string][] = [
      [404, "not_found"], [401, "unauthorized"],
      [403, "forbidden"], [503, "upstream_error"],
    ];
    for (const [s, code] of cases) {
      const f = vi.fn(async () => new Response("", { status: s }));
      await expect(build(f).fetch(URI, CTX)).rejects.toMatchObject({ code });
    }
  });

  it("maps 429 → TeamsRateLimitedError with retry_after_seconds (CRITICAL)", async () => {
    const f = vi.fn(async () =>
      new Response("", { status: 429, headers: { "Retry-After": "12" } }),
    );
    try {
      await build(f).fetch(URI, CTX);
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TeamsRateLimitedError);
      expect((e as TeamsRateLimitedError).meta.retry_after_seconds).toBe(12);
    }
  });

  it("429 without numeric Retry-After omits retry_after_seconds", async () => {
    const cases = [
      new Response("", { status: 429, headers: { "Retry-After": "later" } }),
      new Response("", { status: 429 }),
    ];
    for (const r of cases) {
      const f = vi.fn(async () => r.clone());
      try {
        await build(f).fetch(URI, CTX);
        throw new Error("should throw");
      } catch (e) {
        expect((e as TeamsRateLimitedError).meta.retry_after_seconds).toBeUndefined();
      }
    }
  });

  it("rejects malformed teams URIs and missing tenant (CRITICAL)", async () => {
    await expect(build(vi.fn()).fetch("bad", CTX)).rejects.toBeInstanceOf(
      ConnectorError,
    );
    await expect(
      build(vi.fn()).fetch(URI, NO_TENANT),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
