import { describe, expect, it } from "vitest";
import { InMemoryJtiStore } from "../adapters/jti-revocation.js";
import { importHs256Secret } from "../jwt-keys.js";
import { signToken } from "../jwt.js";
import type { Subject, TokenClaims } from "../types.js";
import { createAuthMiddleware } from "./auth.js";
import { extractBearer, type MinimalContext } from "./context.js";

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
      issuer, audience, subject: "u1", ttlSeconds: 60,
      claims: { email: "u@x.io", roles: ["admin"] },
    });
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    const subject = ctx.get("subject") as Subject;
    expect(subject.kind).toBe("basic");
    expect(subject.id).toBe("u1");
  });

  it("rejects revoked token", async () => {
    const revocations = new InMemoryJtiStore();
    const { token, jti } = await signToken(key, {
      issuer, audience, subject: "u1", ttlSeconds: 60, includeJti: true,
    });
    await revocations.revoke(jti!, 3600);
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience, revocations });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("reads token from cookie", async () => {
    const { token } = await signToken(key, { issuer, audience, subject: "u1", ttlSeconds: 60 });
    const mw = createAuthMiddleware({
      verificationKeys: [key], issuer, audience, cookieName: "session",
    });
    const ctx = makeCtx({ cookie: `other=x; session=${token}` });
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("rejects when no verification keys provided", () => {
    expect(() =>
      createAuthMiddleware({ verificationKeys: [], issuer, audience }),
    ).toThrow();
  });

  it("falls through multiple verification keys until one works", async () => {
    const wrong = importHs256Secret("WRONG-secret-32chars-minimum-aaaaaa");
    const { token } = await signToken(key, { issuer, audience, subject: "u1", ttlSeconds: 60 });
    const mw = createAuthMiddleware({ verificationKeys: [wrong, key], issuer, audience });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    let called = false;
    await mw(ctx, async () => { called = true; });
    expect(called).toBe(true);
  });

  it("rejects when all verification keys fail", async () => {
    const wrong = importHs256Secret("WRONG-secret-32chars-minimum-aaaaaa");
    const { token } = await signToken(wrong, { issuer, audience, subject: "u1", ttlSeconds: 60 });
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("uses a custom resolver when provided", async () => {
    const { token } = await signToken(key, {
      issuer, audience, subject: "u1", ttlSeconds: 60, claims: { email: "u@x.io" },
    });
    const resolver = {
      async resolveByToken({ claims }: { claims: TokenClaims; raw: string }): Promise<Subject> {
        return { kind: "basic", id: `resolved:${claims.sub}`, email: claims.email ?? "", roles: ["custom"] };
      },
    };
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience, resolver });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    const subject = ctx.get("subject") as Subject;
    expect(subject.id).toBe("resolved:u1");
    expect(subject.roles).toEqual(["custom"]);
  });

  it("falls back to claims when resolver returns undefined", async () => {
    const { token } = await signToken(key, { issuer, audience, subject: "u1", ttlSeconds: 60 });
    const resolver = { async resolveByToken(): Promise<undefined> { return undefined; } };
    const mw = createAuthMiddleware({ verificationKeys: [key], issuer, audience, resolver });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    expect((ctx.get("subject") as Subject).id).toBe("u1");
  });

  it("honours custom subjectKey and methodKey", async () => {
    const { token } = await signToken(key, { issuer, audience, subject: "u1", ttlSeconds: 60 });
    const mw = createAuthMiddleware({
      verificationKeys: [key], issuer, audience, subjectKey: "user", methodKey: "auth",
    });
    const ctx = makeCtx({ authorization: `Bearer ${token}` });
    await mw(ctx, async () => {});
    expect((ctx.get("user") as Subject).id).toBe("u1");
    expect(ctx.get("auth")).toBe("jwt");
  });

  it("returns missing_token when cookie header is present but cookie name absent", async () => {
    const mw = createAuthMiddleware({
      verificationKeys: [key], issuer, audience, cookieName: "session",
    });
    const ctx = makeCtx({ cookie: "other=x; another=y" });
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });

  it("returns missing_token when cookieName is set but no cookie header sent", async () => {
    const mw = createAuthMiddleware({
      verificationKeys: [key], issuer, audience, cookieName: "session",
    });
    const ctx = makeCtx();
    await mw(ctx, async () => {});
    expect(ctx.response?.status).toBe(401);
  });
});

describe("extractBearer", () => {
  it("returns the token from a well-formed header", () => {
    expect(extractBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });
  it("is case-insensitive on the scheme", () => {
    expect(extractBearer("bearer xyz")).toBe("xyz");
    expect(extractBearer("BEARER xyz")).toBe("xyz");
  });
  it("returns undefined for non-bearer schemes", () => {
    expect(extractBearer("Basic abc")).toBeUndefined();
    expect(extractBearer("Token abc")).toBeUndefined();
  });
  it("returns undefined for missing/empty header", () => {
    expect(extractBearer(undefined)).toBeUndefined();
    expect(extractBearer("")).toBeUndefined();
  });
  it("returns undefined for Bearer with no token", () => {
    expect(extractBearer("Bearer ")).toBeUndefined();
    expect(extractBearer("Bearer    ")).toBeUndefined();
  });
  it("returns undefined for tokens with internal whitespace", () => {
    expect(extractBearer("Bearer abc def")).toBeUndefined();
  });
});
