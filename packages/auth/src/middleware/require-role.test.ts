import { describe, expect, it } from "vitest";
import type { MinimalContext } from "./context.js";
import { requireRole, requireTenant } from "./require-role.js";

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

describe("requireRole", () => {
  it("allows when subject has role", async () => {
    const mw = requireRole("admin");
    const ctx = makeCtx();
    ctx.set("subject", { kind: "basic", id: "u1", email: "u@x.io", roles: ["admin"] });
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("denies when subject lacks role", async () => {
    const mw = requireRole("admin");
    const ctx = makeCtx();
    ctx.set("subject", { kind: "basic", id: "u1", email: "u@x.io", roles: ["viewer"] });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(403);
  });

  it("denies when no subject", async () => {
    const mw = requireRole("admin");
    const ctx = makeCtx();
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("throws when no roles configured", () => {
    expect(() => requireRole()).toThrow();
  });

  it("accepts when subject has any one of multiple allowed roles", async () => {
    const mw = requireRole("admin", "operator");
    const ctx = makeCtx();
    ctx.set("subject", { kind: "basic", id: "u1", email: "u@x.io", roles: ["operator"] });
    let called = false;
    await mw(ctx, async () => { called = true; });
    expect(called).toBe(true);
  });
});

describe("requireTenant", () => {
  const subject = {
    kind: "multitenant" as const,
    id: "u",
    email: "u@x.io",
    name: "U",
    orgId: "o",
    tenantIds: ["t1", "t2"],
    roles: ["admin"],
  };

  it("allows when header tenant matches subject", async () => {
    const mw = requireTenant();
    const ctx = makeCtx({ "x-tenant-id": "t1" });
    ctx.set("subject", subject);
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("denies when header tenant not in subject", async () => {
    const mw = requireTenant();
    const ctx = makeCtx({ "x-tenant-id": "t9" });
    ctx.set("subject", subject);
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(403);
  });

  it("denies basic subject", async () => {
    const mw = requireTenant();
    const ctx = makeCtx({ "x-tenant-id": "t1" });
    ctx.set("subject", { kind: "basic", id: "u", email: "u@x.io", roles: [] });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(403);
  });

  it("returns 400 when tenant header missing", async () => {
    const mw = requireTenant();
    const ctx = makeCtx();
    ctx.set("subject", subject);
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(400);
  });

  it("returns 401 when no subject is attached", async () => {
    const mw = requireTenant();
    const ctx = makeCtx({ "x-tenant-id": "t1" });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("supports custom header names", async () => {
    const mw = requireTenant("x-org-tenant");
    const ctx = makeCtx({ "x-org-tenant": "t1" });
    ctx.set("subject", subject);
    let called = false;
    await mw(ctx, async () => { called = true; });
    expect(called).toBe(true);
  });
});
