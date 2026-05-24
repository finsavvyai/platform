import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlDecodeString,
  base64UrlEncode,
  randomTokenId,
  sha256Hex,
} from "./token-utils.js";

describe("token-utils", () => {
  it("base64url round-trip string", () => {
    const encoded = base64UrlEncode("hello world");
    expect(base64UrlDecodeString(encoded)).toBe("hello world");
  });

  it("base64url round-trip bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const encoded = base64UrlEncode(bytes);
    expect(base64UrlDecode(encoded)).toEqual(bytes);
  });

  it("base64url has no padding or unsafe chars", () => {
    const encoded = base64UrlEncode("hi");
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("randomTokenId returns unique values", () => {
    const a = randomTokenId(16);
    const b = randomTokenId(16);
    expect(a).not.toBe(b);
  });

  it("sha256Hex deterministic 64 hex chars", async () => {
    const h = await sha256Hex("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await sha256Hex("abc"));
  });
});
