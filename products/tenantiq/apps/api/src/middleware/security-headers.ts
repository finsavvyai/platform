import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"connect-src 'self' https://api.tenantiq.app https://*.sentry.io",
	"font-src 'self'"
].join('; ');

/**
 * Security headers middleware.
 * Sets standard browser security headers on all responses.
 */
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
	await next();

	c.header('Content-Security-Policy', CSP);
	c.header('X-Content-Type-Options', 'nosniff');
	c.header('X-Frame-Options', 'DENY');
	c.header('X-XSS-Protection', '1; mode=block');
	c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
	c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	c.header('Cache-Control', 'no-store');

	if (c.env.ENVIRONMENT !== 'development') {
		c.header(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains'
		);
	}
});
