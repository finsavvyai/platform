import { describe, expect, it } from "vitest";
import { InMemoryJtiStore } from "./adapters/jti-revocation.js";
import { importHs256Secret, type VerificationKey } from "./jwt-keys.js";
import { rotateTokenIfNeeded, signToken, verifyToken } from "./jwt.js";

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
    // Flip the first char of the signature segment so the decoded signature
    // bytes definitely change. Mutating the final base64url char can affect
    // only padding bits for fixed-length HMAC signatures.
    const parts = token.split(".");
    const sig = parts[2]!;
    const flipped = (sig.startsWith("A") ? "B" : "A") + sig.slice(1);
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

  it("maps thrown errors without a `code` property to invalid_token", async () => {
    // jose throws a plain TypeError (no `code`) when the verification key is
    // not a valid key type. Exercises the `?? ""` fallback in the catch arm.
    const { token } = await signToken(key, opts);
    // Strings are not accepted by jose -> TypeError without a `code`.
    const bogus: VerificationKey = {
      alg: "HS256",
      // @ts-expect-error — deliberately bogus runtime value
      key: "not-a-valid-key",
    };
    const res = await verifyToken(bogus, token, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_token");
  });

  it("does not rotate tokens outside the renewal window", async () => {
    const { token } = await signToken(key, {
      ...opts,
      ttlSeconds: 3600,
      claims: { roles: ["admin"] },
      includeJti: true,
    });

    const res = await rotateTokenIfNeeded(key, key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
      ttlSeconds: 3600,
      rotateWithinSeconds: 60,
    });

    expect(res).toMatchObject({ ok: true, rotated: false });
    if (res.ok) expect(res.claims.roles).toEqual(["admin"]);
  });

  it("rotates near-expiry tokens and preserves custom claims", async () => {
    const revocations = new InMemoryJtiStore();
    const { token, jti: oldJti } = await signToken(key, {
      ...opts,
      ttlSeconds: 120,
      claims: { roles: ["admin"], orgId: "o1", tenantIds: ["t1"] },
      includeJti: true,
    });

    const res = await rotateTokenIfNeeded(key, key, token, {
      issuer: opts.issuer,
      audience: opts.audience,
      ttlSeconds: 3600,
      rotateWithinSeconds: 300,
      revocations,
    });

    expect(res).toMatchObject({ ok: true, rotated: true });
    if (res.ok && res.rotated) {
      expect(res.token).not.toBe(token);
      expect(res.jti).toBeTruthy();
      expect(res.jti).not.toBe(oldJti);
      expect(res.claims.roles).toEqual(["admin"]);
      expect(res.claims.orgId).toBe("o1");
      expect(res.claims.tenantIds).toEqual(["t1"]);
      expect(await revocations.isRevoked(oldJti!)).toBe(true);
    }
  });

  it("returns verification errors instead of rotating invalid tokens", async () => {
    const res = await rotateTokenIfNeeded(key, key, "not-a-jwt", {
      issuer: opts.issuer,
      audience: opts.audience,
      ttlSeconds: 3600,
      rotateWithinSeconds: 300,
    });
    expect(res).toStrictEqual({ ok: false, error: "invalid_token" });
  });
});
