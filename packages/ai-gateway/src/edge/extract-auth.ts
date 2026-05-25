import { verifyJwt, type VerifyOptions } from "./jwt.js";
import type { AuthResult } from "./types.js";

/**
 * Extract + verify a Bearer JWT from a `Request`. Pure: no side effects,
 * no audit log writes. The caller decides whether to log decisions.
 *
 * Returns a discriminated union so the handler can map cleanly to status
 * codes without try/catch leaks.
 */
export async function extractAuth(
  request: Request,
  opts: VerifyOptions,
): Promise<AuthResult> {
  const header = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!header) {
    return {
      ok: false,
      status: 401,
      code: "AI_GATEWAY_EDGE_AUTH_MISSING",
      reason: "missing Authorization header",
    };
  }
  if (!header.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      code: "AI_GATEWAY_EDGE_AUTH_SCHEME",
      reason: "Authorization must use Bearer scheme",
    };
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.length === 0) {
    return {
      ok: false,
      status: 401,
      code: "AI_GATEWAY_EDGE_AUTH_EMPTY",
      reason: "empty bearer token",
    };
  }
  try {
    const claims = await verifyJwt(token, opts);
    return { ok: true, claims };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "invalid token";
    return {
      ok: false,
      status: 401,
      code: "AI_GATEWAY_EDGE_AUTH_INVALID",
      reason,
    };
  }
}

/** Best-effort client IP for rate-limit fallback. CF headers preferred. */
export function clientIpOf(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("X-Real-IP");
  if (real) return real;
  return "unknown";
}
