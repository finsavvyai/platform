import type { AuthClaims } from "./types.js";

/**
 * HS256 JWT verify + sign for the edge layer. Web Crypto only (works on
 * Cloudflare Workers, Node 20+, Deno, browsers).
 *
 * Hardening vs. source:
 *   - Uses `crypto.subtle.verify` (constant-time signature check) — this
 *     matches the round-1 hardening convention for timing-safe equality.
 *   - Enforces `alg=HS256` strictly (no algorithm confusion).
 *   - Rejects on parse failure, missing required claims, or expired tokens.
 *   - Optional `clockSkewSeconds` to absorb minor drift.
 */

export type VerifyOptions = {
  readonly secret: string;
  /** Allowed clock drift in seconds for exp/nbf checks. Default 30. */
  readonly clockSkewSeconds?: number;
  /** Injected clock for tests. */
  readonly now?: () => number;
};

const DEFAULT_SKEW = 30;

export async function verifyJwt(
  token: string,
  opts: VerifyOptions,
): Promise<AuthClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("malformed JWT: expected 3 segments");
  }
  const [h64, p64, s64] = parts as [string, string, string];

  const header = decodeJsonSegment(h64, "header");
  if (header["alg"] !== "HS256") {
    throw new Error("JWT alg must be HS256");
  }
  if (header["typ"] !== undefined && header["typ"] !== "JWT") {
    throw new Error("JWT typ must be JWT");
  }

  const signingInput = `${h64}.${p64}`;
  const ok = await verifyHs256(signingInput, s64, opts.secret);
  if (!ok) throw new Error("JWT signature mismatch");

  const payload = decodeJsonSegment(p64, "payload");
  const now = Math.floor((opts.now ?? Date.now)() / 1000);
  const skew = opts.clockSkewSeconds ?? DEFAULT_SKEW;

  const exp = asNumber(payload["exp"]);
  if (exp === undefined) throw new Error("JWT missing exp");
  if (exp + skew < now) throw new Error("JWT expired");

  const iat = asNumber(payload["iat"]) ?? now;
  const sub = asString(payload["sub"]);
  const tenantId = asString(payload["tenantId"]) ?? asString(payload["tid"]);
  const role = asString(payload["role"]) ?? "user";
  if (!sub) throw new Error("JWT missing sub");
  if (!tenantId) throw new Error("JWT missing tenantId");

  const email = asString(payload["email"]);
  return {
    sub,
    tenantId,
    role,
    iat,
    exp,
    ...(email ? { email } : {}),
  };
}

export async function signHs256(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const h64 = base64urlEncodeJson(header);
  const p64 = base64urlEncodeJson(payload);
  const sigBytes = await hmac(`${h64}.${p64}`, secret);
  const s64 = base64urlEncodeBytes(sigBytes);
  return `${h64}.${p64}.${s64}`;
}

async function verifyHs256(
  signingInput: string,
  s64: string,
  secret: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64urlDecode(s64);
  } catch {
    return false;
  }
  // crypto.subtle.verify is constant-time per spec. Detach ArrayBuffer view
  // to satisfy lib.dom BufferSource (rejects SharedArrayBuffer-backed views).
  const sigBuf = sigBytes.buffer.slice(
    sigBytes.byteOffset,
    sigBytes.byteOffset + sigBytes.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(signingInput));
}

async function hmac(input: string, secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return new Uint8Array(buf);
}

function decodeJsonSegment(seg: string, label: string): Record<string, unknown> {
  let bytes: Uint8Array;
  try {
    bytes = base64urlDecode(seg);
  } catch {
    throw new Error(`malformed JWT ${label}: bad base64url`);
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`malformed JWT ${label}: invalid JSON`);
  }
}

function base64urlEncodeJson(obj: unknown): string {
  return base64urlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/gu, "+").replace(/_/gu, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
