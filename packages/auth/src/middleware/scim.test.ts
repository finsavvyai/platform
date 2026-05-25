import { describe, expect, it } from "vitest";
import type { MinimalContext } from "./context.js";
import { createScimAuthMiddleware, generateScimToken, verifyScimTokenHash } from "./scim.js";

type FakeCtx = MinimalContext & {
  readonly state: Map<string, unknown>;
  response?: { body: unknown; status: number };
};

const makeCtx = (headers: Record<string, string> = {}): FakeCtx => {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const state = new Map<string, unknown>();
  const ctx: FakeCtx = {
    state,
    req: { header: (n: string) => headerMap.get(n.toLowerCase()) },
    set: (k, v) => state.set(k, v),
    get: (k) => state.get(k),
    json: <T>(value: T, status = 200): Response => {
      ctx.response = { body: value, status };
      return new Response(JSON.stringify(value), { status });
    },
  };
  return ctx;
};

describe("SCIM middleware", () => {
  it("accepts known token, denies unknown", async () => {
    const issued = await generateScimToken("scim", "pep");
    const lookup = async (hash: string) =>
      hash === issued.hash
        ? { orgId: "o1", scopes: ["scim:read", "scim:write"] }
        : undefined;
    const mw = createScimAuthMiddleware({ lookup, pepper: "pep" });

    const good = makeCtx({ authorization: `Bearer ${issued.plaintext}` });
    let nextCalled = false;
    await mw(good, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(good.get("scimOrgId")).toBe("o1");

    const bad = makeCtx({ authorization: "Bearer nope" });
    await mw(bad, async () => {});
    expect(bad.response?.status).toBe(401);
  });

  it("enforces required scope", async () => {
    const issued = await generateScimToken();
    const lookup = async () => ({ orgId: "o1", scopes: ["scim:read"] });
    const mw = createScimAuthMiddleware({ lookup, requiredScope: "scim:write" });
    const ctx = makeCtx({ authorization: `Bearer ${issued.plaintext}` });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(403);
  });

  it("denies when authorization header is missing", async () => {
    const mw = createScimAuthMiddleware({ lookup: async () => undefined });
    const ctx = makeCtx();
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("verifyScimTokenHash round-trips and rejects mismatches", async () => {
    const issued = await generateScimToken("scim", "pep");
    expect(await verifyScimTokenHash(issued.plaintext, issued.hash, "pep")).toBe(true);
    expect(await verifyScimTokenHash(issued.plaintext, issued.hash, "wrong")).toBe(false);
    expect(await verifyScimTokenHash("wrong", issued.hash, "pep")).toBe(false);
  });

  it("supports a custom orgKey", async () => {
    const issued = await generateScimToken();
    const lookup = async () => ({ orgId: "abc", scopes: ["scim:read"] });
    const mw = createScimAuthMiddleware({ lookup, orgKey: "tenantOrgId" });
    const ctx = makeCtx({ authorization: `Bearer ${issued.plaintext}` });
    await mw(ctx, async () => {});
    expect(ctx.get("tenantOrgId")).toBe("abc");
  });

  it("generateScimToken produces unique plaintexts", async () => {
    const a = await generateScimToken();
    const b = await generateScimToken();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.prefix).toBe("scim");
  });
});
