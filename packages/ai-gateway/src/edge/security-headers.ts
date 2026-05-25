/**
 * Enterprise security headers applied to every edge response. Mirrors the
 * source gateway's hardened defaults; `Strict-Transport-Security` is
 * conditional on caller opting in (don't lock dev/non-https deployments).
 */
export type SecurityHeaderOptions = {
  readonly enableHsts?: boolean;
  readonly gatewayVersion?: string;
};

export function securityHeaders(
  opts: SecurityHeaderOptions = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Download-Options": "noopen",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-Gateway-Version": opts.gatewayVersion ?? "ai-gateway/0.1.0",
  };
  if (opts.enableHsts) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }
  return headers;
}

/** Merge headers into an existing Response without losing the body. */
export function withHeaders(
  res: Response,
  extra: Record<string, string>,
): Response {
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) merged.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}
