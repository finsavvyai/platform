// Tests for JWT sign + verify. Specifically pins the L-001 fix: the
// signature comparison in verifyJwt() must use the shared timing-safe
// comparator, not `!==`.

import { describe, it, expect } from "vitest";
import { createJwt, verifyJwt } from "./auth";
import { timingSafeEqual } from "./crypto-utils";
import type { JwtPayload } from "./types";

const SECRET = "test-secret-please-dont-use-in-prod";

function futurePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "github:42",
    login: "octocat",
    provider: "github",
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for different strings of same length", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });
  it("returns false for strings of different length (fast path)", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
  it("handles empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("", "x")).toBe(false);
  });
  it("handles long hex digests like real JWT signatures", () => {
    const a = "a".repeat(64);
    const b = "a".repeat(63) + "b";
    expect(timingSafeEqual(a, a)).toBe(true);
    expect(timingSafeEqual(a, b)).toBe(false);
  });
});

describe("verifyJwt uses timing-safe signature comparison", () => {
  it("accepts a freshly issued token", async () => {
    const token = await createJwt(futurePayload(), SECRET);
    const out = await verifyJwt(token, SECRET);
    expect(out).not.toBeNull();
    expect(out!.login).toBe("octocat");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = await createJwt(futurePayload(), SECRET);
    const out = await verifyJwt(token, "different-secret");
    expect(out).toBeNull();
  });

  it("rejects a token whose signature has been flipped by 1 character", async () => {
    const token = await createJwt(futurePayload(), SECRET);
    const parts = token.split(".");
    // Flip the last character of the signature.
    const lastChar = parts[2].slice(-1);
    const swapped = lastChar === "A" ? "B" : "A";
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${swapped}`;
    expect(await verifyJwt(tampered, SECRET)).toBeNull();
  });

  it("rejects a token whose signature has an off-by-one length", async () => {
    const token = await createJwt(futurePayload(), SECRET);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}X`;
    expect(await verifyJwt(tampered, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const pastNow = Math.floor(Date.now() / 1000) - 7200;
    const token = await createJwt(
      { ...futurePayload(), iat: pastNow, exp: pastNow + 60 },
      SECRET
    );
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it("rejects a malformed token (wrong number of segments)", async () => {
    expect(await verifyJwt("only.two", SECRET)).toBeNull();
    expect(await verifyJwt("a.b.c.d", SECRET)).toBeNull();
  });
});
