import { base64UrlEncode } from "./token-utils.js";

const encoder = new TextEncoder();

const importHmacKey = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

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

export const timingSafeEqualStr = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
