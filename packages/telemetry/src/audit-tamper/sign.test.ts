import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chainAppend } from "./chain.js";
import {
  HMAC_SHA256_ALGO,
  constantTimeHexEqual,
  createHmacSigner,
  createHmacVerifier,
  hmacSignerFromEnv,
  signRecord,
} from "./sign.js";
import type { AuditRecord } from "../audit-log.js";

const rec = (): AuditRecord => ({
  ts: "2026-01-01T00:00:00.000Z",
  actor_id: "u",
  event: "e",
  resource: "r",
  decision: "allow",
  reason: "",
});

describe("constantTimeHexEqual", () => {
  it("returns true for identical hex strings", () => {
    expect(constantTimeHexEqual("deadbeef", "deadbeef")).toBe(true);
  });

  it("returns false for different equal-length hex strings", () => {
    expect(constantTimeHexEqual("deadbeef", "deadbeee")).toBe(false);
  });

  it("returns false for differing-length hex strings without throwing", () => {
    // Crucial: must NOT early-return based on length (timing channel).
    expect(constantTimeHexEqual("dead", "deadbeef")).toBe(false);
    expect(constantTimeHexEqual("deadbeef", "dead")).toBe(false);
  });

  it("handles empty strings without throwing", () => {
    expect(constantTimeHexEqual("", "")).toBe(true);
    expect(constantTimeHexEqual("", "ab")).toBe(false);
  });
});

describe("HMAC signer/verifier", () => {
  const KEY = "test-key-do-not-use-in-prod";

  it("signs deterministically", () => {
    const signer = createHmacSigner(KEY);
    const a = signer.sign("abc");
    const b = signer.sign("abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(signer.algo).toBe(HMAC_SHA256_ALGO);
  });

  it("verifier accepts a correct sig", () => {
    const signer = createHmacSigner(KEY);
    const verifier = createHmacVerifier(KEY);
    const c = chainAppend(null, rec());
    const signed = signRecord(c, signer);
    expect(verifier.verify(c.hash, signed.sig)).toBe(true);
    expect(verifier.algo).toBe(HMAC_SHA256_ALGO);
  });

  it("verifier rejects a tampered sig", () => {
    const signer = createHmacSigner(KEY);
    const verifier = createHmacVerifier(KEY);
    const c = chainAppend(null, rec());
    const signed = signRecord(c, signer);
    // Flip a hex char.
    const tampered =
      signed.sig.slice(0, -1) + (signed.sig.at(-1) === "0" ? "1" : "0");
    expect(verifier.verify(c.hash, tampered)).toBe(false);
  });

  it("verifier rejects a sig made with a different key", () => {
    const a = createHmacSigner("key-A");
    const b = createHmacVerifier("key-B");
    const c = chainAppend(null, rec());
    const signed = signRecord(c, a);
    expect(b.verify(c.hash, signed.sig)).toBe(false);
  });

  it("verifier rejects a sig over the wrong hash", () => {
    const signer = createHmacSigner(KEY);
    const verifier = createHmacVerifier(KEY);
    const c1 = chainAppend(null, rec());
    const c2 = chainAppend(null, { ...rec(), actor_id: "u2" });
    const signed = signRecord(c1, signer);
    expect(verifier.verify(c2.hash, signed.sig)).toBe(false);
  });

  it("verifier handles malformed (non-hex) sigs without throwing", () => {
    const verifier = createHmacVerifier(KEY);
    expect(() => verifier.verify("a".repeat(64), "not hex!!")).not.toThrow();
    expect(verifier.verify("a".repeat(64), "not hex!!")).toBe(false);
  });

  it("accepts Buffer keys equivalently to string keys", () => {
    const s1 = createHmacSigner(KEY);
    const s2 = createHmacSigner(Buffer.from(KEY, "utf8"));
    expect(s1.sign("h")).toBe(s2.sign("h"));
  });

  it("createHmacVerifier accepts Buffer keys equivalently to string keys", () => {
    // Covers sign.ts line 59 — typeof key === "string" ? ... : key
    // else-branch in createHmacVerifier (Buffer-typed key path).
    const signer = createHmacSigner(KEY);
    const verifierString = createHmacVerifier(KEY);
    const verifierBuffer = createHmacVerifier(Buffer.from(KEY, "utf8"));
    const c = chainAppend(null, rec());
    const signed = signRecord(c, signer);
    expect(verifierString.verify(c.hash, signed.sig)).toBe(true);
    expect(verifierBuffer.verify(c.hash, signed.sig)).toBe(true);
  });
});

describe("hmacSignerFromEnv", () => {
  const prev = process.env.FINSAVVY_AUDIT_HMAC_KEY;
  beforeEach(() => {
    delete process.env.FINSAVVY_AUDIT_HMAC_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.FINSAVVY_AUDIT_HMAC_KEY;
    else process.env.FINSAVVY_AUDIT_HMAC_KEY = prev;
  });

  it("returns null when env var is unset", () => {
    expect(hmacSignerFromEnv()).toBeNull();
  });

  it("returns null when env var is empty", () => {
    process.env.FINSAVVY_AUDIT_HMAC_KEY = "";
    expect(hmacSignerFromEnv()).toBeNull();
  });

  it("returns a signer when env var is set", () => {
    process.env.FINSAVVY_AUDIT_HMAC_KEY = "k";
    const s = hmacSignerFromEnv();
    expect(s).not.toBeNull();
    expect(s?.algo).toBe(HMAC_SHA256_ALGO);
    expect(s?.sign("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
