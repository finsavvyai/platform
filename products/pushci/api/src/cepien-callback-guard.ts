// SSRF guard for the Cepien /callback handler. Limits the worker's
// outbound fetch(callback_url) to HTTPS URLs on the Cepien domain and
// rejects every RFC1918 / link-local / loopback / metadata-service host.
// Keep ≤200 lines — no runtime deps.
//
// License: Apache-2.0

/** Cepien apex host. Callback URLs must match exactly or be a sub of this. */
export const CEPIEN_APEX = "cepien.ai";

export type CallbackStatus = "passed" | "failed" | "stopped";
export const CALLBACK_STATUSES: readonly CallbackStatus[] = ["passed", "failed", "stopped"];
const ALLOWED_CALLBACK_FIELDS = new Set(["pipeline_id", "status", "duration_ms"]);

export interface ParsedCallbackBody {
  pipeline_id: string;
  status: CallbackStatus;
  duration_ms: number;
}

export function parseCallbackBody(v: unknown): ParsedCallbackBody | string {
  if (!v || typeof v !== "object") return "invalid body";
  const obj = v as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_CALLBACK_FIELDS.has(key)) return `unexpected field: ${key}`;
  }
  const pid = obj.pipeline_id;
  const st = obj.status;
  const dur = obj.duration_ms;
  if (typeof pid !== "string" || !pid) return "pipeline_id required";
  if (typeof st !== "string" || !(CALLBACK_STATUSES as readonly string[]).includes(st)) {
    return "status must be passed|failed|stopped";
  }
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) {
    return "duration_ms must be a non-negative number";
  }
  return { pipeline_id: pid, status: st as CallbackStatus, duration_ms: dur };
}

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Check a runner-supplied `Authorization: Bearer <token>` header against
 * the configured PUSHCI_RUNNER_CALLBACK_SECRET. Constant-time compare.
 */
export function isRunnerAuthorized(
  authHeader: string | undefined,
  expected: string | undefined
): boolean {
  if (!expected) return false;
  if (!authHeader) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return false;
  return timingSafeEqStr(m[1], expected);
}

/** IPv4 literal → four octets or null if not a literal. */
function parseIPv4(host: string): number[] | null {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
  const parts = host.split(".").map((p) => Number(p));
  for (const n of parts) {
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
  }
  return parts;
}

/**
 * True if `host` (from URL.hostname) resolves — textually — to a private,
 * loopback, link-local, broadcast, or cloud-metadata address. IPv6 loopback
 * and ULA/link-local are covered. Does NOT perform DNS.
 */
export function isPrivateHost(hostRaw: string): boolean {
  if (!hostRaw) return true;
  // URL.hostname strips brackets from IPv6 in most runtimes, but defensively strip.
  const host = hostRaw.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  // Disallow names that resolve to localhost regardless of DNS.
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0") return true;
  if (host === "broadcasthost") return true;

  // IPv6 loopback / ULA / link-local.
  if (host === "::" || host === "::1") return true;
  if (/^fc[0-9a-f]{2}:/.test(host)) return true; // fc00::/7 (ULA) — matches fc00-fdff
  if (/^fd[0-9a-f]{2}:/.test(host)) return true;
  if (/^fe8[0-9a-f]:/.test(host) || /^fe9[0-9a-f]:/.test(host)) return true; // fe80::/10
  if (/^fea[0-9a-f]:/.test(host) || /^feb[0-9a-f]:/.test(host)) return true;

  const v4 = parseIPv4(host);
  if (v4) {
    const [a, b] = v4;
    if (a === 10) return true;                    // 10.0.0.0/8
    if (a === 127) return true;                   // 127.0.0.0/8 loopback
    if (a === 0) return true;                     // 0.0.0.0/8
    if (a === 169 && b === 254) return true;      // 169.254.0.0/16 link-local + IMDS
    if (a === 192 && b === 168) return true;      // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true;                    // multicast + reserved
    return false;
  }

  return false;
}

/** True iff `host` exactly equals CEPIEN_APEX or ends in ".cepien.ai". */
function hostIsCepien(host: string): boolean {
  const h = host.toLowerCase();
  if (h === CEPIEN_APEX) return true;
  return h.endsWith(`.${CEPIEN_APEX}`);
}

/**
 * Parse and validate a Cepien callback URL.
 *
 * Rules (all must hold — any failure returns null):
 *   1. URL must parse (WHATWG `new URL`).
 *   2. Protocol must be exactly `https:`.
 *   3. Hostname MUST equal `cepien.ai` OR end with `.cepien.ai` — so
 *      `api.cepien.ai.attacker.com` is rejected because `.cepien.ai` is
 *      not a suffix after the trailing dot-separated boundary.
 *   4. Hostname must not resolve (textually) to a private / loopback /
 *      link-local / metadata (169.254.169.254) address.
 *   5. No credentials in the URL (`user:pass@host`).
 *
 * Returns a parsed URL on success, null on any failure. No throws.
 */
export function validateCallbackUrl(raw: string): URL | null {
  if (typeof raw !== "string" || !raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  // URL.hostname is already normalized (lowercase for ASCII). Reject bracketed
  // IPv6 by checking the raw hostname — runtimes strip brackets.
  const host = u.hostname;
  if (!host) return null;
  if (!hostIsCepien(host)) return null;
  if (isPrivateHost(host)) return null;
  return u;
}
