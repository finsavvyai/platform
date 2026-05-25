// Tests for AES-GCM envelope encryption used to protect per-user AWS
// credentials stored in KV (v1.6.6 L-003 fix).

import { describe, it, expect } from "vitest";
import {
  decryptCreds,
  encryptCreds,
  isEnvelope,
  tryDecrypt,
} from "./crypto-envelope";

// 32 zero bytes, base64url. Matches aws-test-helpers.AWS_TEST_ENC_KEY.
const KEY_ZEROS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
// A different 32-byte key, base64url. Used for rotation / wrong-key tests.
const KEY_ONES = "____________________________________________".slice(0, 43);

describe("crypto-envelope round-trip", () => {
  it("encrypts, decrypts, and recovers the original plaintext", async () => {
    const plain = JSON.stringify({ accessKeyId: "AKIA", secretAccessKey: "s3cret" });
    const cipher = await encryptCreds(plain, KEY_ZEROS);
    const out = await decryptCreds(cipher, KEY_ZEROS);
    expect(out).toBe(plain);
  });

  it("produces ciphertext that is NOT the plaintext (no leakage)", async () => {
    const plain = JSON.stringify({ secretAccessKey: "do-not-leak" });
    const cipher = await encryptCreds(plain, KEY_ZEROS);
    expect(cipher).not.toContain("do-not-leak");
    expect(cipher).not.toContain("secretAccessKey");
  });

  it("produces a different ciphertext on each call (random IV)", async () => {
    const plain = JSON.stringify({ a: 1 });
    const a = await encryptCreds(plain, KEY_ZEROS);
    const b = await encryptCreds(plain, KEY_ZEROS);
    expect(a).not.toBe(b);
  });

  it("ciphertext is a JSON envelope with v/iv/ct", async () => {
    const cipher = await encryptCreds("hello", KEY_ZEROS);
    const parsed = JSON.parse(cipher) as {
      v: number;
      iv: string;
      ct: string;
    };
    expect(parsed.v).toBe(1);
    expect(parsed.iv).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parsed.ct).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("crypto-envelope tamper detection", () => {
  it("decrypt fails on modified ciphertext (GCM auth tag)", async () => {
    const cipher = await encryptCreds("secret-plaintext", KEY_ZEROS);
    const parsed = JSON.parse(cipher) as { v: 1; iv: string; ct: string };
    // Flip a character in the ciphertext — GCM must reject.
    const tampered = JSON.stringify({
      ...parsed,
      ct: parsed.ct.replace(/^./, (c) => (c === "A" ? "B" : "A")),
    });
    await expect(decryptCreds(tampered, KEY_ZEROS)).rejects.toThrow();
  });

  it("decrypt fails with the wrong key (key rotation / confused env)", async () => {
    const cipher = await encryptCreds("secret", KEY_ZEROS);
    await expect(decryptCreds(cipher, KEY_ONES)).rejects.toThrow();
  });

  it("rejects non-32-byte master key", async () => {
    const short = "AAAA"; // 3 bytes
    await expect(encryptCreds("x", short)).rejects.toThrow(/32 bytes/);
  });

  it("rejects unsupported envelope version", async () => {
    const fake = JSON.stringify({ v: 2, iv: "AA", ct: "BB" });
    await expect(decryptCreds(fake, KEY_ZEROS)).rejects.toThrow(/format/);
  });
});

describe("crypto-envelope migration helpers", () => {
  it("isEnvelope detects v1 envelopes", async () => {
    const cipher = await encryptCreds("x", KEY_ZEROS);
    expect(isEnvelope(cipher)).toBe(true);
  });

  it("isEnvelope rejects legacy plain JSON", () => {
    expect(isEnvelope('{"mode":"role","region":"us-east-1"}')).toBe(false);
    expect(isEnvelope("not-json-at-all")).toBe(false);
    expect(isEnvelope("")).toBe(false);
  });

  it("tryDecrypt returns null for null input", async () => {
    expect(await tryDecrypt(null, KEY_ZEROS)).toBeNull();
  });

  it("tryDecrypt passes through legacy plain JSON unchanged", async () => {
    const legacy = '{"mode":"role","region":"us-east-1"}';
    expect(await tryDecrypt(legacy, KEY_ZEROS)).toBe(legacy);
  });

  it("tryDecrypt decrypts an envelope", async () => {
    const cipher = await encryptCreds("migrated", KEY_ZEROS);
    expect(await tryDecrypt(cipher, KEY_ZEROS)).toBe("migrated");
  });

  it("tryDecrypt throws on envelope without a key (loud failure)", async () => {
    const cipher = await encryptCreds("x", KEY_ZEROS);
    await expect(tryDecrypt(cipher, undefined)).rejects.toThrow(/required/);
  });
});
