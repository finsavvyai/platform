/**
 * Public surface for the brain rate-limit subsystem.
 *
 * Mesh §10 contract types + sliding-window decider + tenant-aware
 * composite + Hono middleware. All other modules import from this
 * barrel so internal layout can change without churning callers.
 */

export type {
  RateLimitConfig,
  RateLimitDecision,
  RateLimitMiddlewareOptions,
  RateLimitReason,
  RateLimitRejection,
  RateLimitStore,
} from "./types.js";

export { decideSlidingWindow } from "./sliding-window.js";

export {
  checkTenantRateLimit,
  tenantKey,
  type TenantRateLimitInput,
  type TenantRateLimitResult,
} from "./tenant-rate-limit.js";

export { createRateLimitMiddleware } from "./middleware.js";
