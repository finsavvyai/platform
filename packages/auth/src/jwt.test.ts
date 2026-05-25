import { describe, expect, it } from "vitest";
import { InMemoryJtiStore } from "./adapters/jti-revocation.js";
import { importHs256Secret } from "./jwt-keys.js";
import { signToken, verifyToken } from "./jwt.js";

const key = importHs256Secret("supersecretvalue-32chars-minimum-1234");
const otherKey = importHs256Secret("DIFFERENT-secret-32chars-minimum-9876");

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

  it("rejects wrong issuer", async () => {
    const { token } = await signToken(key, opts);
    const res = await verifyToken(key, token, {
      issuer: "https://attacker.test",
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("rejects tampered signature", async () => {
    const { token } = await signToken(key, opts);
    // Flip the last char of the signature segment.
    const parts = token.split(".");
    const sig = parts[2]!;
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
    const res = await verifyToken(key, tampered, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("rejects token signed with different secret (alg-confusion proof)", async () => {
    const { token } = await signToken(otherKey, opts);
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("rejects alg=none forgery", async () => {
    // Hand-craft an unsigned token: header alg=none, no signature.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: opts.issuer,
        aud: opts.audience,
        sub: "attacker",
        exp: now + 60,
        iat: now,
      }),
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;
    const res = await verifyToken(key, noneToken, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("rejects empty token", async () => {
    const res = await verifyToken(key, "", {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("rejects garbage token", async () => {
    const res = await verifyToken(key, "not-a-jwt", {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("fails closed when issuer option is empty", async () => {
    const { token } = await signToken(key, opts);
    const res = await verifyToken(key, token, { issuer: "", audience: opts.audience });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("fails closed when audience option is empty", async () => {
    const { token } = await signToken(key, opts);
    const res = await verifyToken(key, token, { issuer: opts.issuer, audience: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("allows token through when revocations store is provided but jti is absent", async () => {
    const revocations = new InMemoryJtiStore();
    const { token } = await signToken(key, opts); // no jti
    const res = await verifyToken(key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
      revocations,
    });
    expect(res.ok).toBe(true);
  });
});
