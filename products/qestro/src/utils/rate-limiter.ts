/**
 * Rate Limiter Utility
 *
 * Simple rate limiting for API endpoints
 */

import type { MiddlewareHandler } from "hono";

export const rateLimiter: MiddlewareHandler = async (c, next) => {
  // Simple rate limiting based on client IP
  const clientIP =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const key = `rate-limit:${clientIP}`;

  // In a real implementation, you'd use KV to track requests
  // For now, we'll just pass through
  await next();
};
