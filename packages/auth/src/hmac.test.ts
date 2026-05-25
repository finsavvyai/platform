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

  it("timing-safe returns false when one side is empty", () => {
    expect(timingSafeEqualStr("", "abc")).toBe(false);
    expect(timingSafeEqualStr("abc", "")).toBe(false);
  });

  it("timing-safe accepts equal empty strings", () => {
    expect(timingSafeEqualStr("", "")).toBe(true);
  });

  it("timing-safe distinguishes near-identical equal-length strings", () => {
    const a = "a".repeat(64);
    const b = "a".repeat(63) + "b";
    expect(timingSafeEqualStr(a, b)).toBe(false);
  });

  it("hmacSign rejects empty secret", async () => {
    await expect(hmacSign("", "data")).rejects.toThrow();
  });

  it("hmacVerify rejects wrong-length signature", async () => {
    const sig = await hmacSign("s", "d");
    expect(await hmacVerify("s", "d", sig.slice(0, -2))).toBe(false);
    expect(await hmacVerify("s", "d", sig + "AA")).toBe(false);
  });
});
