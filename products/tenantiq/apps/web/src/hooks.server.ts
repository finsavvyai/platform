import type { Handle, HandleServerError } from '@sveltejs/kit';

/**
 * CSP + common hardening headers. The Sentry ingest host is allowed in
 * `connect-src` so browser events (from hooks.client.ts) can be sent.
 *
 * Note: `@sentry/sveltekit` server bundle omits `init`/`sentryHandle` when
 * compiled for the Cloudflare Workers runtime (Pages), so server-side
 * Sentry is intentionally skipped. Client-side reporting still covers
 * most real-world user errors.
 */
// Widened to cover real prod integrations:
//   - assets.lemonsqueezy.com serves lemon.js
//   - static.cloudflareinsights.com is the CF Web Analytics beacon
//   - 'unsafe-inline' on script-src covers a handful of tiny inline scripts
//     in app.html (JSON-LD, lemon init). Proper mitigation = move to SvelteKit's
//     hash-mode CSP via svelte.config.js `kit.csp`; until then allow inline.
const CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://app.lemonsqueezy.com https://assets.lemonsqueezy.com https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"font-src 'self' data:",
	"connect-src 'self' https://api.tenantiq.app https://app.lemonsqueezy.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://cloudflareinsights.com wss://api.tenantiq.app",
	"frame-src 'self' https://app.lemonsqueezy.com",
	"frame-ancestors 'none'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self' https://api.tenantiq.app",
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};

export const handleError: HandleServerError = ({ error, event }) => {
	const errorId = crypto.randomUUID();
	console.error(`[error:${errorId}] ${event.url.pathname}`, error);
	return { message: 'Server error', code: errorId };
};
