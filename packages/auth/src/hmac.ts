import { timingSafeEqual } from "node:crypto";
import { base64UrlEncode } from "./token-utils.js";

const encoder = new TextEncoder();

const importHmacKey = async (secret: string): Promise<CryptoKey> => {
  if (secret.length === 0) {
    throw new Error("hmac secret must be non-empty");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

export const hmacSign = async (
  secret: string,
  data: string,
): Promise<string> => {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(sig));
};

export const hmacVerify = async (
  secret: string,
  data: string,
  signature: string,
): Promise<boolean> => {
  const expected = await hmacSign(secret, data);
  return timingSafeEqualStr(expected, signature);
};

// Constant-time equality for base64url/hex strings.
// Uses node:crypto.timingSafeEqual, which requires equal-length buffers.
// On length mismatch we still consume work proportional to the longer input
// (so the duration does not leak which side was shorter), then return false.
export const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) {
    const maxLen = Math.max(ab.length, bb.length, 1);
    const left = new Uint8Array(maxLen);
    const right = new Uint8Array(maxLen);
    left.set(ab);
    right.set(bb);
    timingSafeEqual(left, right);
    return false;
  }
  return timingSafeEqual(ab, bb);
};

export const hashApiKey = async (
  plaintext: string,
  pepper: string = "",
): Promise<string> => {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(pepper + plaintext),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
