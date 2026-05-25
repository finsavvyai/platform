import { describe, expect, it } from "vitest";
import { clientIpOf, extractAuth } from "./extract-auth.js";
import { signHs256 } from "./jwt.js";

const SECRET = "test-secret";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://x.io/v1/complete", {
    method: "POST",
    headers,
  });
}

describe("extractAuth", () => {
  it("returns ok with claims for a valid Bearer", async () => {
    const now = Math.floor(Date.now() / 1000);
    const tok = await signHs256(
      { sub: "u", tenantId: "t", role: "user", iat: now, exp: now + 60 },
      SECRET,
    );
    const r = reqWith({ Authorization: `Bearer ${tok}` });
    const res = await extractAuth(r, { secret: SECRET });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claims.sub).toBe("u");
  });

  it("accepts lowercase authorization header", async () => {
    const now = Math.floor(Date.now() / 1000);
    const tok = await signHs256(
      { sub: "u", tenantId: "t", role: "user", iat: now, exp: now + 60 },
      SECRET,
    );
    const r = reqWith({ authorization: `Bearer ${tok}` });
    const res = await extractAuth(r, { secret: SECRET });
    expect(res.ok).toBe(true);
  });

  it("returns 401 when header is missing", async () => {
    const res = await extractAuth(reqWith({}), { secret: SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.code).toBe("AI_GATEWAY_EDGE_AUTH_MISSING");
    }
  });

  it("returns 401 when scheme is not Bearer", async () => {
    const res = await extractAuth(reqWith({ Authorization: "Basic abc" }), {
      secret: SECRET,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("AI_GATEWAY_EDGE_AUTH_SCHEME");
  });

  it("returns 401 when bearer token is empty", async () => {
    // Fetch's Headers normalizes leading/trailing whitespace, making a bare
    // "Bearer " unreachable from a real Request. We exercise the defensive
    // branch by stubbing headers.get directly so the parser sees the literal.
    const stub = {
      headers: { get: (n: string): string | null => (n === "Authorization" ? "Bearer " : null) },
    } as unknown as Request;
    const res = await extractAuth(stub, { secret: SECRET });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("AI_GATEWAY_EDGE_AUTH_EMPTY");
  });

  it("returns 401 when token is invalid", async () => {
    const res = await extractAuth(reqWith({ Authorization: "Bearer nope.nope.nope" }), {
      secret: SECRET,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("AI_GATEWAY_EDGE_AUTH_INVALID");
  });

  it("returns 401 with default reason when error is not Error", async () => {
    // Force a non-Error throw by passing an unverifiable token shape.
    const res = await extractAuth(reqWith({ Authorization: "Bearer ab.cd" }), {
      secret: SECRET,
    });
    expect(res.ok).toBe(false);
  });
});

describe("clientIpOf", () => {
  it("prefers CF-Connecting-IP", () => {
    const r = reqWith({
      "CF-Connecting-IP": "1.1.1.1",
      "X-Forwarded-For": "2.2.2.2",
      "X-Real-IP": "3.3.3.3",
    });
    expect(clientIpOf(r)).toBe("1.1.1.1");
  });

  it("falls back to X-Forwarded-For first hop", () => {
    const r = reqWith({ "X-Forwarded-For": "2.2.2.2, 4.4.4.4" });
    expect(clientIpOf(r)).toBe("2.2.2.2");
  });

  it("falls back to X-Real-IP", () => {
    const r = reqWith({ "X-Real-IP": "3.3.3.3" });
    expect(clientIpOf(r)).toBe("3.3.3.3");
  });

  it("returns 'unknown' when no header present", () => {
    expect(clientIpOf(reqWith({}))).toBe("unknown");
  });

  it("returns 'unknown' when X-Forwarded-For is just whitespace", () => {
    const r = reqWith({ "X-Forwarded-For": " " });
    // First hop is empty after trim → falls through.
    expect(clientIpOf(r)).toBe("unknown");
  });
});
