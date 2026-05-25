/** CORS, JSON helpers, security headers, and rate-limit header utilities. */

export function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "https://llm.finsavvyai.com",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function json(data, status, headers) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function rateLimitHeaders(rl) {
  const h = {};
  if (rl.limit) {
    h["X-RateLimit-Limit"] = String(rl.limit);
    h["X-RateLimit-Remaining"] = String(Math.max(0, rl.remaining));
  }
  if (rl.retryAfter) h["Retry-After"] = String(rl.retryAfter);
  return h;
}
