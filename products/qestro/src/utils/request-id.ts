/**
 * Request ID Utility
 *
 * Generates unique request IDs for tracking
 */

import type { MiddlewareHandler } from "hono";
import { nanoid } from "nanoid";

export const requestId: MiddlewareHandler = async (c, next) => {
  const requestId = nanoid();
  c.set("requestId", requestId);

  // Add request ID to response headers
  c.res.headers.set("X-Request-ID", requestId);

  await next();
};
