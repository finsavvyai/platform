/**
 * Security Headers Middleware — Helmet-equivalent for Cloudflare Workers
 *
 * Adds comprehensive security headers to all responses:
 * - HSTS, CSP, X-Content-Type-Options, X-Frame-Options, etc.
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

export const securityHeaders = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    await next();

    // Strict Transport Security — force HTTPS for 1 year + subdomains
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Content Security Policy — restrict resource loading
    c.header('Content-Security-Policy', [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://api.lunaos.ai https://api.lemonsqueezy.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; '));

    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY');

    // XSS Protection (legacy browsers)
    c.header('X-XSS-Protection', '1; mode=block');

    // Don't send referrer on cross-origin requests
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict browser features
    c.header('Permissions-Policy', [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=(self)',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
    ].join(', '));

    // Prevent cross-origin attacks
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Embedder-Policy', 'require-corp');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');

    // Remove server identification
    c.res.headers.delete('Server');
    c.res.headers.delete('X-Powered-By');
});
