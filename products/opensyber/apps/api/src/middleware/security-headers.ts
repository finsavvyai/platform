import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types.js';

export const securityHeaders: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'");
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-DNS-Prefetch-Control', 'off');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
};
