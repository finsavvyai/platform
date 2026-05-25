import { describe, expect, it } from "vitest";
import { signHs256, verifyJwt } from "./jwt.js";

const SECRET = "test-secret-1234567890";

async function signValid(
  extras: Record<string, unknown> = {},
  expIn = 60,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  return signHs256(
    {
      sub: "user-1",
      tenantId: "t-1",
      role: "user",
      iat: now,
      exp: now + expIn,
      ...extras,
    },
    SECRET,
  );
}

describe("verifyJwt", () => {
  it("verifies a valid HS256 token", async () => {
    const token = await signValid();
    const claims = await verifyJwt(token, { secret: SECRET });
    expect(claims.sub).toBe("user-1");
    expect(claims.tenantId).toBe("t-1");
    expect(claims.role).toBe("user");
  });

  it("returns email when present", async () => {
    const token = await signValid({ email: "u@x.io" });
    const claims = await verifyJwt(token, { secret: SECRET });
    expect(claims.email).toBe("u@x.io");
  });

  it("accepts `tid` as a tenantId alias", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { sub: "u", tid: "tenant-9", role: "user", iat: now, exp: now + 60 },
      SECRET,
    );
    const claims = await verifyJwt(token, { secret: SECRET });
    expect(claims.tenantId).toBe("tenant-9");
  });

  it("defaults role to 'user' when missing", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { sub: "u", tenantId: "t", iat: now, exp: now + 60 },
      SECRET,
    );
    const claims = await verifyJwt(token, { secret: SECRET });
    expect(claims.role).toBe("user");
  });

  it("rejects malformed token (wrong segment count)", async () => {
    await expect(verifyJwt("a.b", { secret: SECRET })).rejects.toThrow(/3 segments/u);
  });

  it("rejects wrong signature", async () => {
    const token = await signValid();
    await expect(
      verifyJwt(token, { secret: "different-secret" }),
    ).rejects.toThrow(/signature mismatch/u);
  });

  it("rejects non-HS256 alg", async () => {
    // Hand-craft a header with alg=none.
    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replace(/=+$/u, "")
      .replace(/\+/gu, "-")
      .replace(/\//gu, "_");
    const payload = btoa(JSON.stringify({ sub: "x", exp: 9999999999 }))
      .replace(/=+$/u, "")
      .replace(/\+/gu, "-")
      .replace(/\//gu, "_");
    const tok = `${header}.${payload}.sig`;
    await expect(verifyJwt(tok, { secret: SECRET })).rejects.toThrow(/HS256/u);
  });

  it("rejects expired tokens (beyond skew)", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await signHs256(
      { sub: "u", tenantId: "t", role: "user", iat: past, exp: past + 10 },
      SECRET,
    );
    await expect(verifyJwt(token, { secret: SECRET })).rejects.toThrow(/expired/u);
  });

  it("accepts tokens within clock skew", async () => {
    const past = Math.floor(Date.now() / 1000) - 20;
    const token = await signHs256(
      { sub: "u", tenantId: "t", role: "user", iat: past - 30, exp: past },
      SECRET,
    );
    const claims = await verifyJwt(token, { secret: SECRET, clockSkewSeconds: 60 });
    expect(claims.sub).toBe("u");
  });

  it("rejects missing exp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { sub: "u", tenantId: "t", role: "user", iat: now },
      SECRET,
    );
    await expect(verifyJwt(token, { secret: SECRET })).rejects.toThrow(/missing exp/u);
  });

  it("rejects missing sub", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { tenantId: "t", role: "user", iat: now, exp: now + 60 },
      SECRET,
    );
    await expect(verifyJwt(token, { secret: SECRET })).rejects.toThrow(/missing sub/u);
  });

  it("rejects missing tenantId", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signHs256(
      { sub: "u", role: "user", iat: now, exp: now + 60 },
      SECRET,
    );
    await expect(verifyJwt(token, { secret: SECRET })).rejects.toThrow(/missing tenantId/u);
  });

  it("rejects bad base64 in payload", async () => {
    // Header is valid (so we reach payload decode), payload contains chars
    // that aren't in base64url alphabet → atob throws → decodeJsonSegment
    // surfaces 'bad base64url'.
    const enc = (o: unknown): string =>
      btoa(JSON.stringify(o))
        .replace(/=+$/u, "")
        .replace(/\+/gu, "-")
        .replace(/\//gu, "_");
    const h = enc({ alg: "HS256", typ: "JWT" });
    const realToken = await signHs256(
      { sub: "x", tenantId: "t", role: "r", iat: 1, exp: 9_999_999_999 },
      SECRET,
    );
    const realSig = realToken.split(".")[2]!;
    const tok = `${h}.!!!.${realSig}`;
    await expect(verifyJwt(tok, { secret: SECRET })).rejects.toThrow(/base64url|signature/u);
  });

  it("rejects bad base64 in header", async () => {
    const tok = `!!!.payload.sig`;
    await expect(verifyJwt(tok, { secret: SECRET })).rejects.toThrow(/base64url/u);
  });

  it("rejects non-object payload", async () => {
    const enc = (o: unknown): string =>
      btoa(JSON.stringify(o))
        .replace(/=+$/u, "")
        .replace(/\+/gu, "-")
        .replace(/\//gu, "_");
    const h = enc({ alg: "HS256", typ: "JWT" });
    const p = enc([1, 2, 3]);
    // Need a real signature to pass alg check first.
    const sig = await signHs256({ sub: "x", tenantId: "t", role: "r", iat: 1, exp: 9999999999 }, SECRET);
    const realSig = sig.split(".")[2]!;
    await expect(verifyJwt(`${h}.${p}.${realSig}`, { secret: SECRET })).rejects.toThrow();
  });

  it("rejects typ that is not JWT", async () => {
    const enc = (o: unknown): string =>
      btoa(JSON.stringify(o))
        .replace(/=+$/u, "")
        .replace(/\+/gu, "-")
        .replace(/\//gu, "_");
    const h = enc({ alg: "HS256", typ: "JOSE" });
    const p = enc({ sub: "x", tenantId: "t", role: "r", iat: 1, exp: 9999999999 });
    await expect(verifyJwt(`${h}.${p}.sig`, { secret: SECRET })).rejects.toThrow(/typ/u);
  });
});

describe("signHs256", () => {
  it("produces a three-segment compact JWS", async () => {
    const tok = await signHs256({ sub: "x", tenantId: "t", role: "r", iat: 1, exp: 9_999_999_999 }, SECRET);
    expect(tok.split(".")).toHaveLength(3);
  });

  it("round-trips sign+verify", async () => {
    const now = Math.floor(Date.now() / 1000);
    const tok = await signHs256(
      { sub: "rt", tenantId: "rt", role: "admin", iat: now, exp: now + 30 },
      SECRET,
    );
    const claims = await verifyJwt(tok, { secret: SECRET });
    expect(claims.sub).toBe("rt");
    expect(claims.role).toBe("admin");
  });
});
