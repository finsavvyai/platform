import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';

interface RateLimitOptions {
	limit: number;
	windowSeconds: number;
	keyPrefix: string;
}

// FNV-1a 32-bit — cheap UA fingerprint for keying, not cryptographic.
function hashUA(ua: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < ua.length; i++) {
		h ^= ua.charCodeAt(i);
		h = (h * 0x01000193) >>> 0;
	}
	return h.toString(16);
}

/**
 * Rate limiting via Cloudflare KV.
 *
 * Keying: `ratelimit:<prefix>:<sub|anon>:<ip>:<uaHash>`. Including IP + UA for
 * authenticated users prevents a shared token from being drained by one actor.
 * For anonymous requests UA hashing splits NAT-shared IPs.
 *
 * Atomicity: KV has no CAS. We narrow the race window by awaiting the put
 * before calling next() — a full fix requires Durable Objects or the
 * Cloudflare Rate Limiting API.
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
	return createMiddleware<AppEnv>(async (c, next) => {
		let user: { sub?: string } | undefined;
		try { user = c.get('user'); } catch { /* unauthenticated */ }

		const ip = c.req.header('cf-connecting-ip')
			?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
			?? 'anonymous';
		const sub = user?.sub ?? 'anon';
		const uaHash = hashUA(c.req.header('user-agent') ?? '');
		const key = `ratelimit:${options.keyPrefix}:${sub}:${ip}:${uaHash}`;

		const current = await c.env.KV.get(key);
		const count = current ? parseInt(current, 10) : 0;

		if (count >= options.limit) {
			c.header('Retry-After', String(options.windowSeconds));
			return c.json(
				{
					error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
					retryAfter: options.windowSeconds,
				},
				429,
			);
		}

		await c.env.KV.put(key, String(count + 1), { expirationTtl: options.windowSeconds });

		c.header('X-RateLimit-Limit', String(options.limit));
		c.header('X-RateLimit-Remaining', String(Math.max(0, options.limit - count - 1)));

		await next();
	});
}
