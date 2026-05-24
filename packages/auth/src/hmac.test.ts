import { describe, expect, it } from "vitest";
import { hashApiKey, hmacSign, hmacVerify, timingSafeEqualStr } from "./hmac.js";

describe("hmac", () => {
  const secret = "test-secret";
  const data = "payload";

  it("signs and verifies round-trip", async () => {
    const sig = await hmacSign(secret, data);
    expect(await hmacVerify(secret, data, sig)).toBe(true);
  });

  it("rejects wrong signature", async () => {
    const sig = await hmacSign(secret, data);
    expect(await hmacVerify(secret, data, sig + "X")).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const sig = await hmacSign(secret, data);
    expect(await hmacVerify("other", data, sig)).toBe(false);
  });

  it("timing-safe equals true for equal", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
  });

  it("timing-safe equals false for diff length", () => {
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
  });

  it("hashApiKey is deterministic", async () => {
    const h1 = await hashApiKey("k1", "p");
    const h2 = await hashApiKey("k1", "p");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("hashApiKey varies with pepper", async () => {
    const a = await hashApiKey("k1", "p1");
    const b = await hashApiKey("k1", "p2");
    expect(a).not.toBe(b);
  });
});
