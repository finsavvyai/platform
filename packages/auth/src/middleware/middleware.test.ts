import { describe, expect, it } from "vitest";
import { InMemoryJtiStore } from "../adapters/jti-revocation.js";
import { importHs256Secret } from "../jwt-keys.js";
import { signToken } from "../jwt.js";
import type { Subject } from "../types.js";
import { createAuthMiddleware } from "./auth.js";
import type { MinimalContext } from "./context.js";
import { requireRole, requireTenant } from "./require-role.js";
import { createScimAuthMiddleware, generateScimToken } from "./scim.js";

type FakeCtx = MinimalContext & {
  readonly headers: Map<string, string>;
  readonly state: Map<string, unknown>;
  response?: { body: unknown; status: number };
};

const makeCtx = (headers: Record<string, string> = {}): FakeCtx => {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const state = new Map<string, unknown>();
  const ctx: FakeCtx = {
    headers: headerMap,
    state,
    req: {
      header: (name: string) => headerMap.get(name.toLowerCase()),
    },
    set: (k, v) => state.set(k, v),
    get: (k) => state.get(k),
    json: <T>(value: T, status = 200): Response => {
      ctx.response = { body: value, status };
      return new Response(JSON.stringify(value), { status });
    },
  };
  return ctx;
};

const key = importHs256Secret("supersecretvalue-32chars-minimum-1234");
const issuer = "https://i.test";
const audience = "api";

describe("createAuthMiddleware", () => {
  it("rejects missing token", async () => {
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience });
    const ctx = makeCtx();
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("attaches subject on valid token", async () => {
    const { token } = await signToken(key, {
      issuer,
      audience,
      subject: "u1",
      ttlSeconds: 60,
      claims: { email: "u@x.io", roles: ["admin"] },
    });
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    let nextCalled = false;
    await mw(ctx, async () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    const subject = ctx.get("subject") as Subject;
    expect(subject.kind).toBe("basic");
    expect(subject.id).toBe("u1");
  });

  it("rejects revoked token", async () => {
    const revocations = new InMemoryJtiStore();
    const { token, jti } = await signToken(key, {
      issuer,
      audience,
      subject: "u1",
      ttlSeconds: 60,
      includeJti: true,
    });
    await revocations.revoke(jti!, 3600);
    const mw = createAuthMiddleware({
      verificationKeys: [key],
      issuer,
      audience,
      revocations,
    });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("reads token from cookie", async () => {
    const { token } = await signToken(key, {
      issuer,
      audience,
      subject: "u1",
      ttlSeconds: 60,
    });
    const mw = createAuthMiddleware({
      verificationKeys: [key],
      issuer,
      audience,
      cookieName: "session",
    });
    const ctx = makeCtx({ cookie: `other=x; session=${token}` });
    let nextCalled = false;
    await mw(ctx, async () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("rejects when no verification keys provided", () => {
    expect(() =>
      createAuthMiddleware({ verificationKeys: [], issuer, audience }),
    ).toThrow();
  });
});

describe("requireRole", () => {
  it("allows when subject has role", async () => {
    const mw = requireRole("admin");
    const ctx = makeCtx();
    ctx.set("subject", { kind: "basic", id: "u1", email: "u@x.io", roles: ["admin"] });
    let nextCalled = false;
    await mw(ctx, async () => {
      nextCalled = true;
    });
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
    await mw(ctx, async () => {
      nextCalled = true;
    });
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
});

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
    await mw(good, async () => {
      nextCalled = true;
    });
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
});
