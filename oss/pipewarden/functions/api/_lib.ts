// Shared helpers for PipeWarden Cloudflare Pages Functions.
// Files starting with `_` are not routed — safe to import from siblings.

export interface Env {
  WAITLIST_KV?: KVNamespace;
  WAITLIST_WEBHOOK_URL?: string;
  WAITLIST_WEBHOOK_SECRET?: string;
  WAITLIST_RATE_LIMIT?: string;   // e.g. "10" → 10 req / window
  WAITLIST_RATE_WINDOW?: string;  // e.g. "600" → 10-minute window (seconds)
  WAITLIST_BASE_URL?: string;     // canonical URL for verify links
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ALLOWED_TIERS = new Set([
  "community", "starter", "team", "growth",
  "professional", "enterprise", "enterprise_plus", "demo",
]);

export const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});

export const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

// Rate limit: N requests per window per IP. Returns { allowed, remaining, resetAt }.
// No-op when KV isn't bound (Community / dev Pages project without KV namespace).
export async function rateLimit(env: Env, ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}> {
  const limit = parseInt(env.WAITLIST_RATE_LIMIT ?? "10", 10);
  const windowSec = parseInt(env.WAITLIST_RATE_WINDOW ?? "600", 10);
  const reset = Math.floor(Date.now() / 1000) + windowSec;
  if (!env.WAITLIST_KV || !ip) return { allowed: true, remaining: limit, resetAt: reset, limit };

  const key = `rl:${ip}`;
  const raw = await env.WAITLIST_KV.get(key);
  let count = raw ? parseInt(raw, 10) : 0;
  if (isNaN(count)) count = 0;
  count += 1;
  const allowed = count <= limit;
  // put with expirationTtl — KV auto-expires the bucket.
  await env.WAITLIST_KV.put(key, String(count), { expirationTtl: windowSec });
  return { allowed, remaining: Math.max(0, limit - count), resetAt: reset, limit };
}

// Simple CSPRNG token; 32 hex chars. Safe for email verification links.
export function newToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

// ClientIP lifts the IP the rate limiter should key on. Prefers
// CF-Connecting-IP (always set by Cloudflare edge), falls back to
// X-Forwarded-For first hop.
export function clientIP(req: Request): string {
  const cf = req.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const xff = req.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "";
}

// Canonical base URL for verify links. Falls back to the request origin.
export function baseURL(req: Request, env: Env): string {
  if (env.WAITLIST_BASE_URL) return env.WAITLIST_BASE_URL.replace(/\/$/, "");
  try { return new URL(req.url).origin; } catch { return "https://pipewarden.com"; }
}
