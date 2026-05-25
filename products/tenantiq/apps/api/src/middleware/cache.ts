/**
 * KV-based response caching middleware with ETag support.
 * Caches GET responses in Cloudflare KV for configurable TTL.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';

interface CacheOptions {
	/** Time-to-live in seconds */
	ttl: number;
	/** KV key prefix for namespacing */
	prefix: string;
}

/** Generate a simple hash for ETag from response body. */
function generateETag(body: string): string {
	let hash = 0;
	for (let i = 0; i < body.length; i++) {
		hash = ((hash << 5) - hash + body.charCodeAt(i)) | 0;
	}
	return `"${(hash >>> 0).toString(36)}"`;
}

/** Build cache key from prefix, path, and tenant context. */
function buildKey(prefix: string, path: string, tenantId?: string): string {
	const tenant = tenantId || 'global';
	return `cache:${prefix}:${tenant}:${path}`;
}

/** Invalidate a cached endpoint response. */
export function bustCache(kv: KVNamespace, prefix: string, path: string, tenantId?: string): Promise<void> {
	return kv.delete(buildKey(prefix, path, tenantId));
}

/**
 * KV cache middleware factory. Apply to GET endpoints that return
 * expensive or infrequently-changing data.
 */
export function kvCache(options: CacheOptions) {
	return createMiddleware<AppEnv>(async (c, next) => {
		// Only cache GET requests
		if (c.req.method !== 'GET') {
			await next();
			return;
		}

		const tenantId = c.get('tenantId');
		const key = buildKey(options.prefix, c.req.path, tenantId);

		// Check cache — only use if value is a JSON string starting with { or [
		const cached = await c.env.KV.get(key);
		if (typeof cached === 'string' && (cached.startsWith('{') || cached.startsWith('['))) {
			try {
				const parsed = JSON.parse(cached);
				const etag = generateETag(cached);

				const ifNoneMatch = c.req.header('If-None-Match');
				if (ifNoneMatch === etag) {
					return c.body(null, 304);
				}

				c.header('X-Cache', 'HIT');
				c.header('ETag', etag);
				c.header('Cache-Control', `private, max-age=${options.ttl}`);
				return c.json(parsed);
			} catch {
				// Invalid cache entry, proceed to handler
			}
		}

		await next();

		// Cache successful JSON responses
		if (c.res.status === 200) {
			const body = await c.res.clone().text();
			const etag = generateETag(body);

			c.header('X-Cache', 'MISS');
			c.header('ETag', etag);
			c.header('Cache-Control', `private, max-age=${options.ttl}`);

			const putPromise = c.env.KV.put(key, body, {
				expirationTtl: options.ttl,
			});

			try {
				c.executionCtx.waitUntil(putPromise);
			} catch {
				// In test environments executionCtx may not exist
				await putPromise;
			}
		}
	});
}
