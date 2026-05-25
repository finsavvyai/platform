import type { Context, Next } from 'hono';

/**
 * Rate Limiting Middleware
 *
 * Implements per-tenant rate limiting using Cloudflare KV.
 * Prevents abuse while allowing legitimate traffic.
 */

interface RateLimitConfig {
	maxRequests: number; // Max requests per window
	windowMs: number; // Time window in milliseconds
	keyPrefix?: string; // Optional prefix for KV keys
}

const DEFAULT_CONFIG: RateLimitConfig = {
	maxRequests: 100,
	windowMs: 60000, // 1 minute
	keyPrefix: 'ratelimit',
};

/**
 * Creates a rate limiting middleware with custom configuration
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	return async (c: Context, next: Next) => {
		const tenantId = c.get('tenantId');
		const userRole = c.get('userRole');

		// Super admins bypass rate limiting
		if (userRole === 'super_admin') {
			await next();
			return;
		}

		if (!tenantId) {
			return c.json({ error: 'Unauthorized', message: 'Missing tenant context' }, 401);
		}

		// Check if KV is available
		if (!c.env.KV) {
			console.warn('KV namespace not configured, skipping rate limiting');
			await next();
			return;
		}

		const now = Date.now();
		const windowStart = now - finalConfig.windowMs;
		const key = `${finalConfig.keyPrefix}:${tenantId}:${Math.floor(now / finalConfig.windowMs)}`;

		try {
			// Get current request count
			const currentCount = await c.env.KV.get(key);
			const count = currentCount ? parseInt(currentCount, 10) : 0;

			if (count >= finalConfig.maxRequests) {
				return c.json(
					{
						error: 'Too Many Requests',
						message: `Rate limit exceeded. Maximum ${finalConfig.maxRequests} requests per ${finalConfig.windowMs / 1000} seconds.`,
						retryAfter: Math.ceil(finalConfig.windowMs / 1000),
					},
					429
				);
			}

			// Increment counter
			await c.env.KV.put(key, String(count + 1), {
				expirationTtl: Math.ceil(finalConfig.windowMs / 1000) + 10, // Add buffer
			});

			// Set rate limit headers
			c.header('X-RateLimit-Limit', String(finalConfig.maxRequests));
			c.header('X-RateLimit-Remaining', String(finalConfig.maxRequests - count - 1));
			c.header('X-RateLimit-Reset', String(Math.ceil((now + finalConfig.windowMs) / 1000)));

			await next();
		} catch (error) {
			console.error('Rate limiting error:', error);
			// Fail open - allow request if rate limiting fails
			await next();
		}
	};
}

/**
 * Stricter rate limiting for sensitive operations
 */
export const strictRateLimit = rateLimit({
	maxRequests: 10,
	windowMs: 60000, // 10 requests per minute
	keyPrefix: 'ratelimit:strict',
});

/**
 * Moderate rate limiting for standard API operations
 */
export const standardRateLimit = rateLimit({
	maxRequests: 100,
	windowMs: 60000, // 100 requests per minute
	keyPrefix: 'ratelimit:standard',
});

/**
 * Lenient rate limiting for read-only operations
 */
export const lenientRateLimit = rateLimit({
	maxRequests: 1000,
	windowMs: 60000, // 1000 requests per minute
	keyPrefix: 'ratelimit:lenient',
});

/**
 * Webhook rate limiting — 100 requests per minute
 */
export const webhookRateLimit = rateLimit({
	maxRequests: 100,
	windowMs: 60000,
	keyPrefix: 'ratelimit:webhook',
});
