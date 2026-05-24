import { describe, expect, it } from "vitest";
import { InMemoryJtiStore } from "./adapters/jti-revocation.js";
import { importHs256Secret } from "./jwt-keys.js";
import { signToken, verifyToken } from "./jwt.js";

const key = importHs256Secret("supersecretvalue-32chars-minimum-1234");

describe("jwt sign/verify", () => {
  const opts = {
    issuer: "https://issuer.test",
    audience: "test-api",
    subject: "user-1",
    ttlSeconds: 60,
  };

  it("signs and verifies", async () => {
    const { token } = await signToken(key, opts);
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claims.sub).toBe("user-1");
  });

  it("emits jti when requested", async () => {
    const { jti } = await signToken(key, { ...opts, includeJti: true });
    expect(jti).toBeTruthy();
    expect(jti).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects wrong audience", async () => {
    const { token } = await signToken(key, opts);
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: "other-api",
    });
    expect(res.ok).toBe(false);
  });

  it("detects expired token", async () => {
    const { token } = await signToken(key, { ...opts, ttlSeconds: -1 });
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("expired_token");
  });

  it("honors JTI revocation", async () => {
    const revocations = new InMemoryJtiStore();
    const { token, jti } = await signToken(key, { ...opts, includeJti: true });
    await revocations.revoke(jti!, 3600);
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
      revocations,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("revoked_token");
  });

  it("carries custom claims", async () => {
    const { token } = await signToken(key, {
      ...opts,
      claims: { email: "u@x.io", roles: ["admin"], tenantIds: ["t1"], orgId: "o1", name: "U" },
    });
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claims.email).toBe("u@x.io");
      expect(res.claims.roles).toEqual(["admin"]);
      expect(res.claims.orgId).toBe("o1");
    }
  });
});
