import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';

/**
 * Middleware to generate and attach a unique request ID (correlation ID) to each request.
 * This ID is used for tracing requests across logs and distributed systems.
 */
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
	// Check if request ID is provided by client (e.g., from load balancer or API gateway)
	const existingId = c.req.header('x-request-id') || c.req.header('x-correlation-id');

	// Generate new request ID if not provided
	const requestId = existingId || crypto.randomUUID();

	// Store in context for access in route handlers
	c.set('requestId' as any, requestId);

	// Add to response headers for client-side debugging
	c.header('x-request-id', requestId);

	await next();
});
