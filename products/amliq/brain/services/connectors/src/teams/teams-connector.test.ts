/**
 * `TeamsConnector.list` tests. `fetch()` tests live in
 * `teams-connector.fetch.test.ts` so each file stays under the 200-line
 * cap and per-method blast radius is clear.
 */
import { describe, expect, it, vi } from "vitest";
import { type TenantContext } from "../types.js";
import { TeamsConnector } from "./teams-connector.js";

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

function build(
  fakeFetch: typeof fetch,
  teamResolver: (t: string) => string = () => TEAM_ID,
): { c: TeamsConnector; teamSpy: ReturnType<typeof vi.fn> } {
  const teamSpy = vi.fn((t: string) => teamResolver(t));
  return {
    c: new TeamsConnector({
      baseUrl: BASE,
      tokenForTenant: (t) => `bearer-${t}`,
      teamIdForTenant: teamSpy,
      httpFetch: fakeFetch,
    }),
    teamSpy,
  };
}

function searchBody(
  hits: ReadonlyArray<{
    id: string;
    teamId?: string;
    channelId?: string;
    content?: string;
    displayName?: string;
    lastModifiedDateTime?: string;
  }>,
  more = false,
) {
  return {
    value: [{
      hitsContainers: [{
        hits: hits.map((h) => ({
          hitId: h.id,
          resource: {
            id: h.id,
            body: { content: h.content ?? "" },
            from: h.displayName ? { user: { displayName: h.displayName } } : undefined,
            lastModifiedDateTime: h.lastModifiedDateTime ?? "",
            channelIdentity: {
              teamId: h.teamId ?? TEAM_ID,
              channelId: h.channelId ?? "channel-1",
            },
          },
        })),
        moreResultsAvailable: more,
      }],
    }],
  };
}

describe("TeamsConnector.list", () => {
  it("maps hits to ConnectorListItems on happy path", async () => {
    const f = vi.fn(async () =>
      jsonRes(searchBody([{
        id: "msg-1", channelId: "ch-1",
        content: "<p>Alert <b>123</b></p>",
        displayName: "Alice",
        lastModifiedDateTime: "2026-05-25T12:00:00Z",
      }])),
    );
    const r = await build(f).c.list({ text: "alert" }, CTX);
    expect(r.items[0]).toEqual({
      uri: `teams:${TEAM_ID}:ch-1:msg-1`,
      title: "Alice",
      snippet: "Alert 123",
      updated_at: "2026-05-25T12:00:00Z",
    });
    expect(r.cursor).toBeNull();
  });

  it("enforces tenant→team isolation in KQL via teamIdForTenant (CRITICAL)", async () => {
    const seen: string[] = [];
    const bodies: string[] = [];
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(input));
      bodies.push(typeof init?.body === "string" ? init.body : "");
      return jsonRes(searchBody([]));
    });
    const { c, teamSpy } = build(f);
    await c.list({ text: 'a"b' }, CTX);
    expect(teamSpy).toHaveBeenCalledWith("tenant-acme");
    expect(seen[0]).toContain("/v1.0/search/query");
    const kql = JSON.parse(bodies[0] ?? "{}").requests[0].query.queryString as string;
    expect(kql).toContain(`channelIdentity/teamId:${TEAM_ID}`);
    expect(kql).toContain('"a\\"b"');
  });

  it("still tenant-scoped when text is empty (CRITICAL)", async () => {
    const bodies: string[] = [];
    const f = vi.fn(async (_i, init?: RequestInit) => {
      bodies.push(typeof init?.body === "string" ? init.body : "");
      return jsonRes(searchBody([]));
    });
    await build(f).c.list({ text: "" }, CTX);
    const kql = JSON.parse(bodies[0] ?? "{}").requests[0].query.queryString;
    expect(kql.startsWith("(channelIdentity/teamId:")).toBe(true);
  });

  it("rejects when teamIdForTenant returns empty (CRITICAL)", async () => {
    const { c } = build(vi.fn(), () => "");
    await expect(c.list({ text: "x" }, CTX)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("rejects missing tenant_id (CRITICAL)", async () => {
    const { c } = build(vi.fn());
    await expect(c.list({ text: "x" }, NO_TENANT)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("paginates via from offset when moreResultsAvailable is true", async () => {
    const f = vi.fn(async () =>
      jsonRes(searchBody([{ id: "m1" }, { id: "m2" }], true)),
    );
    const r = await build(f).c.list({ text: "x", limit: 2 }, CTX);
    expect(r.cursor).toBe("2");
    const f2 = vi.fn(async () => jsonRes(searchBody([{ id: "m3" }], false)));
    const r2 = await build(f2).c.list(
      { text: "x", limit: 2, cursor: "2" },
      CTX,
    );
    expect(r2.cursor).toBeNull();
  });

  it("falls back when hits array is missing", async () => {
    const f = vi.fn(async () =>
      jsonRes({ value: [{ hitsContainers: [{}] }] }),
    );
    const r = await build(f).c.list({ text: "x" }, CTX);
    expect(r.items).toEqual([]);
    expect(r.cursor).toBeNull();
  });

  it("defaults baseUrl when not provided", () => {
    const c = new TeamsConnector({
      tokenForTenant: () => "t",
      teamIdForTenant: () => "tm",
      httpFetch: vi.fn(),
    });
    expect(c.source).toBe("teams");
  });
});
