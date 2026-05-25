import { describe, expect, it, vi } from "vitest";
import { ConnectorError, type TenantContext } from "../types.js";
import {
  SlackConnector,
  type SlackClient,
  type SlackMessageResponse,
  type SlackSearchResponse,
} from "./slack-connector.js";

const CTX: TenantContext = {
  tenant_id: "tenant-acme",
  actor_id: "user-1",
  roles: ["analyst"],
};
const NO_TENANT: TenantContext = { tenant_id: "", actor_id: "u", roles: [] };

function mkClient(overrides: Partial<SlackClient> = {}): SlackClient {
  return { searchMessages: vi.fn(), fetchMessage: vi.fn(), ...overrides };
}
function searchOk(
  matches: SlackSearchResponse["matches"],
  next?: string,
): SlackSearchResponse {
  return next ? { ok: true, matches, next_cursor: next } : { ok: true, matches };
}
function build(client: SlackClient): SlackConnector {
  return new SlackConnector({ client, tokenForTenant: (t) => `xoxb-${t}` });
}

describe("SlackConnector.list", () => {
  it("returns mapped items on happy path", async () => {
    const client = mkClient({
      searchMessages: vi.fn().mockResolvedValue(
        searchOk([
          {
            channel: { id: "C1", name: "compliance" },
            ts: "1700000000.000100",
            text: "Hello <b>world</b>",
            permalink: "https://slack.example/x",
          },
        ]),
      ),
    });
    const r = await build(client).list({ text: "kyc" }, CTX);
    expect(r.items[0]).toMatchObject({
      uri: "slack://C1/1700000000.000100",
      title: "#compliance",
      snippet: "Hello world",
    });
    expect(r.cursor).toBeNull();
  });

  it("propagates pagination cursor", async () => {
    const client = mkClient({
      searchMessages: vi.fn().mockResolvedValue(searchOk([], "next-1")),
    });
    const r = await build(client).list({ text: "x", cursor: "page-0" }, CTX);
    expect(r.cursor).toBe("next-1");
    expect(client.searchMessages).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "page-0" }),
    );
  });

  it("clamps limit into [1, 100]", async () => {
    const client = mkClient({
      searchMessages: vi.fn().mockResolvedValue(searchOk([])),
    });
    const c = build(client);
    await c.list({ text: "x", limit: 9999 }, CTX);
    await c.list({ text: "x", limit: 0 }, CTX);
    const calls = (client.searchMessages as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0].count).toBe(100);
    expect(calls[1][0].count).toBe(1);
  });

  it("enforces tenant isolation and per-tenant token (CRITICAL)", async () => {
    const tokenSpy = vi.fn((t: string) => `xoxb-${t}`);
    const client = mkClient({
      searchMessages: vi.fn().mockResolvedValue(searchOk([])),
    });
    const c = new SlackConnector({ client, tokenForTenant: tokenSpy });
    await c.list({ text: "kyc" }, CTX);
    const arg = (client.searchMessages as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(arg.query).toContain("tenant:tenant-acme");
    expect(arg.token).toBe("xoxb-tenant-acme");
    expect(tokenSpy).toHaveBeenCalledWith("tenant-acme");
  });

  it("rejects missing tenant_id (CRITICAL)", async () => {
    await expect(
      build(mkClient()).list({ text: "x" }, NO_TENANT),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("maps !ok → upstream_error (with and without error string)", async () => {
    const c1 = mkClient({
      searchMessages: vi
        .fn()
        .mockResolvedValue({ ok: false, error: "ratelimited", matches: [] }),
    });
    await expect(
      build(c1).list({ text: "x" }, CTX),
    ).rejects.toMatchObject({ code: "upstream_error" });
    // exercise the `res.error ?? "search_failed"` branch
    const c2 = mkClient({
      searchMessages: vi.fn().mockResolvedValue({ ok: false, matches: [] }),
    });
    await expect(
      build(c2).list({ text: "x" }, CTX),
    ).rejects.toMatchObject({ code: "upstream_error" });
  });
});

describe("SlackConnector.fetch", () => {
  const okMsg: SlackMessageResponse = {
    ok: true,
    text: "approved transaction 42",
    channel: "C1",
    ts: "1700000000.000200",
  };

  it("returns a ComplianceDoc with stable doc_id, sha256, tenant token", async () => {
    const client = mkClient({ fetchMessage: vi.fn().mockResolvedValue(okMsg) });
    const doc = await build(client).fetch(
      "slack://C1/1700000000.000200",
      CTX,
    );
    expect(doc).toMatchObject({
      source: "slack",
      jurisdiction: "internal",
      doc_id: "slack:C1:1700000000.000200",
      body: "approved transaction 42",
    });
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(client.fetchMessage).toHaveBeenCalledWith(
      expect.objectContaining({ token: "xoxb-tenant-acme" }),
    );
  });

  it("rejects missing tenant_id (CRITICAL)", async () => {
    await expect(
      build(mkClient()).fetch("slack://C1/1", NO_TENANT),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("maps message_not_found → not_found, other !ok → upstream_error", async () => {
    const c1 = mkClient({
      fetchMessage: vi
        .fn()
        .mockResolvedValue({ ok: false, error: "message_not_found" }),
    });
    await expect(
      build(c1).fetch("slack://C1/1700000000.0", CTX),
    ).rejects.toMatchObject({ code: "not_found" });
    const c2 = mkClient({
      fetchMessage: vi.fn().mockResolvedValue({ ok: false, error: "boom" }),
    });
    await expect(
      build(c2).fetch("slack://C1/1700000000.0", CTX),
    ).rejects.toMatchObject({ code: "upstream_error" });
  });

  it("rejects malformed URIs and bad ts", async () => {
    await expect(
      build(mkClient()).fetch("not-a-slack-uri", CTX),
    ).rejects.toBeInstanceOf(ConnectorError);
    const c = mkClient({ fetchMessage: vi.fn().mockResolvedValue(okMsg) });
    await expect(
      build(c).fetch("slack://C1/notnumeric", CTX),
    ).rejects.toMatchObject({ code: "invalid_uri" });
  });

  it("falls back to placeholder title when body normalises to empty", async () => {
    const client = mkClient({
      fetchMessage: vi.fn().mockResolvedValue({ ...okMsg, text: "   " }),
    });
    const doc = await build(client).fetch("slack://C1/1700000000.0", CTX);
    expect(doc.title).toBe("slack message 1700000000.0");
    expect(doc.body).toBe("");
  });

  it("missing text in !ok→false response → upstream_error", async () => {
    const client = mkClient({
      fetchMessage: vi.fn().mockResolvedValue({ ok: true }),
    });
    await expect(
      build(client).fetch("slack://C1/1700000000.0", CTX),
    ).rejects.toMatchObject({ code: "upstream_error" });
  });
});
